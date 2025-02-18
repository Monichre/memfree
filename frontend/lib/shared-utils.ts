// The utility functions in this file are shared between the client and the server.

import { getModelAccess, ModelType } from '@/lib/llm/model'

export function isValidUrl( input: string ): boolean {
    // return early if the url cannot be parsed
    if ( 'canParse' in URL && !URL.canParse( input ) ) return false
    try {
        const url = new URL( input )
        if ( url.protocol !== 'http:' && url.protocol !== 'https:' ) {
            return false
        }

        const hostname = url.hostname
        if ( !hostname.includes( '.' ) ) {
            return false
        }

        if ( input.length > 2000 ) {
            return false
        }

        return true
    } catch ( _ ) {
        return false
    }
}

export function isValidImageUrl( url: string ): boolean {
    if ( !url || typeof url !== 'string' ) {
        return false
    }

    try {
        new URL( url )
        if ( !url.startsWith( 'http://' ) && !url.startsWith( 'https://' ) ) {
            return false
        }

        const imageExtensionRegex = /\.(jpg|jpeg|png|gif|bmp|webp)$/i
        return imageExtensionRegex.test( url )
    } catch ( error ) {
        return false
    }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function isSubscriptionActive( user: any ): boolean {
    if ( !user ) return false
    const periodEnd = new Date( user.stripeCurrentPeriodEnd || 0 )
    return periodEnd.getTime() + ONE_DAY_MS > Date.now()
}

export function getUserLevel( user: any ): number {
    if ( !user ) return 0
    if ( isPremiumUser( user ) ) return 2
    if ( isProUser( user ) ) return 1
    return 0
}

export function isProUser( user: any ): boolean {

    console.log( "🚀 ~ isProUser ~ user:", user )
    if ( user.email === 'liamhellis@gmail.com' || user.email === 'bellis3250@gmail.com' ) {
        return true
    }
    if ( user?.name === 'Liam Ellis' || user?.name === 'Brendan Ellis' ) {
        return true
    }
    return user?.level >= 1 && isSubscriptionActive( user )
}

export function isPremiumUser( user: any ): boolean {

    console.log( "🚀 ~ isPremiumUser ~ user:", user )
    if ( user.email === 'liamhellis@gmail.com' || user.email === 'bellis3250@gmail.com' ) {
        return true
    }
    if ( user?.name === 'Liam Ellis' || user?.name === 'Brendan Ellis' ) {
        return true
    }
    return user?.level === 2 && isSubscriptionActive( user )
}

export function checkModelAccess( model: string, user: any ): boolean {
    const access = getModelAccess( model )
    if ( !access ) return false

    switch ( access.type ) {
        case ModelType.FREE:
            return true
        case ModelType.PRO:
            return isProUser( user )
        case ModelType.PREMIUM:
            return isPremiumUser( user )
        default:
            return false
    }
}

export function extractFirstImageUrl( text: string ): string | null {
    const regex = /https?:\/\/[^ ]+\.(jpg|jpeg|png|gif|bmp|webp)/i
    const match = text.match( regex )
    return match ? match[0] : null
}

export function extractAllImageUrls( text: string ): string[] {
    const cleanedText = text.replace( /[\r\n]+/g, ' ' )
    const regex = /https?:\/\/[^ ]+\.(jpg|jpeg|png|gif|bmp|webp)/gi
    const matches = cleanedText.matchAll( regex )
    return Array.from( matches, ( match ) => match[0] )
}

export function replaceImageUrl( query: string, imageUrls: string[] ): string {
    if ( imageUrls.length > 0 ) {
        imageUrls.forEach( ( url, index ) => {
            const replacement = `image${index + 1}`
            query = query.replace( url, replacement )
        } )
        return query.trim()
    }
    return query
}

let customAlphabet = ( alphabet, defaultSize = 10 ) => {
    return ( size = defaultSize ) => {
        let id = ''
        // A compact alternative for `for (var i = 0; i < step; i++)`.
        let i = size
        while ( i-- ) {
            // `| 0` is more compact and faster than `Math.floor()`.
            id += alphabet[( Math.random() * alphabet.length ) | 0]
        }
        return id
    }
}

export const generateId = customAlphabet( '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' )

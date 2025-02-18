import 'server-only'

import { CoreMessage, CoreUserMessage, ImagePart, LanguageModel, TextPart } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { Claude_35_Sonnet, DEEPSEEK, GPT_4o, GPT_4o_MIMI, O1_MINI, O1, O3_MINI } from '@/lib/llm/model'
import { google } from '@ai-sdk/google'
import { Message } from '@/lib/types'
import { DEEPSEEK_API_KEY, OPENAI_BASE_URL } from '@/lib/env'

export type RoleType = 'user' | 'assistant' | 'system'

export interface StreamHandler {
    ( message: string | null, done: boolean ): void
}

export function getMaxOutputToken( isPro: boolean, model: string ) {
    if ( !isPro ) {
        return 2048
    }
    switch ( model ) {
        case GPT_4o:
        case GPT_4o_MIMI:
            return 16384
        case O1_MINI:
        case O1:
            return 32768
        case O3_MINI:
            return 32768
        case Claude_35_Sonnet:
            return 8192
        default:
            return 8192
    }
}
// max_completion_tokens

const openai = createOpenAI( {
    baseURL: OPENAI_BASE_URL,
} )

const deepseek = createOpenAI( {
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: DEEPSEEK_API_KEY,
} )

const anthropic = createAnthropic( {} )

export function getLLM( model: string ): LanguageModel {
    if ( model.startsWith( 'claude' ) ) {
        return anthropic( model, {
            cacheControl: true,
        } )
    } else if ( model.startsWith( 'gemini' ) ) {
        return google( model )
    } else if ( model.startsWith( 'deepseek' ) ) {
        return deepseek( model )
    } else {
        return openai( model )
    }
}

export function convertToCoreMessages( messages: Message[] ): CoreMessage[] {
    const coreMessages: CoreMessage[] = []
    for ( const message of messages ) {
        switch ( message.role ) {
            case 'user': {
                coreMessages.push( createUserMessages( message.content, message.attachments ) as CoreUserMessage )
                break
            }
            case 'assistant': {
                coreMessages.push( { role: 'assistant', content: message.content } )
                break
            }
            case 'system': {
                coreMessages.push( { role: 'system', content: message.content } )
                break
            }
            default: {
                throw new Error( `Unhandled role: ${message.role}` )
            }
        }
    }
    return coreMessages
}

export function createUserMessages( query: string, attachments: string[] = [] ) {
    let text = query
    // if (attachments.length === 0) {
    //     attachments = extractAllImageUrls(query);
    //     if (attachments.length > 0) {
    //         text = replaceImageUrl(query, attachments);
    //     }
    // }
    return {
        role: 'user',
        content: [{ type: 'text', text: text }, ...attachmentsToParts( attachments )],
    }
}

type ContentPart = TextPart | ImagePart

function attachmentsToParts( attachments: string[] ): ContentPart[] {
    const parts: ContentPart[] = []
    for ( const attachment of attachments ) {
        parts.push( { type: 'image', image: attachment } )
    }
    return parts
}

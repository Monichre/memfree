import { AIImageGenerator } from '@/components/image/image-generator'
import { siteConfig } from '@/config'
import { getLatestPublicImages } from '@/lib/store/image'
import { Metadata } from 'next/types'

const seoTitle = 'Generate Image With Recraft-v3 AI | Digital Mischief Group AI'
const description = 'One Click Generate Image With Recraft-v3 AI | Digital Mischief Group AI'
const url = siteConfig.url + '/generate-image'

export const metadata: Metadata = {
    title: seoTitle,
    description: description,
    alternates: {
        canonical: url,
    },
    twitter: {
        card: 'summary_large_image',
        site: url,
        title: seoTitle,
        description: description,
        images: '/og.png',
        creator: '@Digital Mischief Group',
    },
}

export default async function Page() {
    const images = await getLatestPublicImages()
    return (
        <div className="min-h-screen flex flex-col w-full items-center justify-center bg-gradient-to-b from-primary/[0.04] to-transparen">
            <h1 className="text-3xl font-bold text-center pt-10">Generate Image With AI</h1>
            <div className="container mx-auto px-4 py-12">
                <AIImageGenerator images={images} />
            </div>
        </div>
    )
}

import FeedbackForm from '@/components/layout/feedback'
import { siteConfig } from '@/config'
import { Metadata } from 'next/types'

const seoTitle = 'Digital Mischief Group AI Feedback'
const description = 'Share your Feedback to improve Digital Mischief Group AI'
const url = siteConfig.url + '/feedback'

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

export default function Feedback() {
    return <FeedbackForm />
}

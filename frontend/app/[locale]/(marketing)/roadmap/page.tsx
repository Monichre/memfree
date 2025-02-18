import RoadmapPage from '@/app/[locale]/(marketing)/roadmap/client-wapper'
import { siteConfig } from '@/config'

export const metadata = {
    title: 'Digital Mischief Group Roadmap -- All-in-One AI Assistant for Indie Makers',
    description: 'Digital Mischief Group Roadmap -- All-in-One AI Assistant for Indie Makers',
    alternates: {
        canonical: siteConfig.url + '/changelog',
    },
}

export default function Roadmap() {
    return <RoadmapPage />
}

import { getCurrentUser } from '@/lib/session'
import { getUserImages } from '@/lib/store/image'
import { ImageList } from '@/components/dashboard/image-list'
import { redirect } from 'next/navigation'

export default async function MyPages() {
    const user = await getCurrentUser()
    if ( !user ) {
        redirect( '/login' )
    }
    const images = await getUserImages()

    return (
        <div className="flex flex-col items-center justify-between space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Digital Mischief Group Image Gallery</h1>
            </div>
            <ImageList user={user} images={images} fetcher={getUserImages} />
        </div>
    )
}

import { createClient } from '@/services/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import DeleteAppAssetButton from '@/components/admin/DeleteAppAssetButton'
import type { AppAsset } from '@/types'

export default async function AssetsPage() {
  const supabase = await createClient()
  
  const { data: assets } = await supabase
    .from('app_assets')
    .select('*')
    .order('created_at', { ascending: false })

  const appAssets = (assets as AppAsset[]) || []

  return (
    <>
      {/* Sub Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight uppercase">
            Assets
          </h2>
          <p className="text-neutral-500 mt-2">Manage images for the APP generation feature</p>
        </div>
        <Link
          href="/admin/app/assets/new"
          className="px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors"
        >
          + New Asset
        </Link>
      </div>

      {/* Assets Grid */}
      {appAssets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {appAssets.map((asset) => (
            <div 
              key={asset.id} 
              className="border border-black/10 overflow-hidden group"
            >
              {/* Image */}
              <div className="aspect-square relative bg-neutral-100">
                <Image
                  src={asset.image_url}
                  alt={asset.filename}
                  fill
                  className="object-cover"
                />
              </div>
              
              {/* Info */}
              <div className="p-4 space-y-2">
                <div>
                  <span className="text-xs uppercase tracking-wider text-neutral-400">Category</span>
                  <p className="font-medium truncate">{asset.category}</p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider text-neutral-400">Prompt</span>
                  <p className="text-sm text-neutral-600 line-clamp-2">{asset.prompt}</p>
                </div>
                <div className="text-xs text-neutral-400">
                  {new Date(asset.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Actions */}
              <div className="flex border-t border-black/10">
                <Link
                  href={`/admin/app/assets/${asset.id}`}
                  className="flex-1 px-4 py-3 text-center text-xs uppercase tracking-widest hover:bg-neutral-100 transition-colors"
                >
                  Edit
                </Link>
                <div className="w-px bg-black/10" />
                <DeleteAppAssetButton 
                  assetId={asset.id} 
                  assetFilename={asset.filename}
                  imageUrl={asset.image_url}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-black/10 p-16 text-center">
          <p className="text-neutral-500 mb-6">No assets yet</p>
          <Link
            href="/admin/app/assets/new"
            className="inline-block px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors"
          >
            Add First Asset
          </Link>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 p-6 border border-black/10 bg-neutral-50">
        <h3 className="font-medium mb-2">How it works</h3>
        <p className="text-sm text-neutral-500">
          Assets are images that APP users can select when generating new images. Each asset has a category for organization 
          and a prompt that describes the image style or content. Users can browse assets by category and use them as references for generation.
        </p>
      </div>
    </>
  )
}

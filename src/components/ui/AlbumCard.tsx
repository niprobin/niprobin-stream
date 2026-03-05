import { cn } from '@/lib/utils'

interface AlbumCardProps {
  album: {
    album: string
    artist: string
    cover_url?: string
    cover?: string  // Search.tsx uses 'cover' instead of 'cover_url'
  }
  onClick: () => void
  actionButton?: React.ReactNode
  bottomButton?: React.ReactNode
  className?: string
}

export function AlbumCard({ album, onClick, actionButton, bottomButton, className }: AlbumCardProps) {
  // Handle both cover_url (Albums.tsx) and cover (Search.tsx) properties
  const coverUrl = album.cover_url || album.cover

  return (
    <div className={cn("group cursor-pointer", className)} onClick={onClick}>
      <div className="border border-slate-700 aspect-square rounded-xl overflow-hidden bg-slate-900 relative">
        <img
          src={coverUrl}
          alt={`${album.album} by ${album.artist}`}
          className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        {actionButton && (
          <div className="absolute top-2 right-2">
            {actionButton}
          </div>
        )}
      </div>
      <div className="px-1 mt-2">
        <p className="text-white font-semibold text-sm line-clamp-2">{album.album}</p>
        <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{album.artist}</p>
        {bottomButton && (
          <div className="mt-2">
            {bottomButton}
          </div>
        )}
      </div>
    </div>
  )
}
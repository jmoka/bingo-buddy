import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Avatar as ShadAvatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User } from 'lucide-react'

interface Props {
  url: string | null
}

export default function PlayerAvatar({ url }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (url) {
      downloadImage(url)
    } else {
      setAvatarUrl(null);
    }
  }, [url])

  async function downloadImage(path: string) {
    try {
      const { data, error } = await supabase.storage.from('avatars').download(path)
      if (error) {
        throw error
      }
      const url = URL.createObjectURL(data)
      setAvatarUrl(url)
    } catch (error) {
      console.log('Error downloading image: ', (error as Error).message)
    }
  }

  return (
    <ShadAvatar>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt="Avatar" />
      ) : (
        <AvatarFallback>
          <User className="w-4 h-4" />
        </AvatarFallback>
      )}
    </ShadAvatar>
  )
}
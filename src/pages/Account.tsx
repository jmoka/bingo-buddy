import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'
import Avatar from '@/components/Avatar'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function Account() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState<string | null>(null)
  const [cpf, setCpf] = useState<string | null>(null)
  const [whatsapp, setWhatsapp] = useState<string | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  
  useEffect(() => {
    if (!session) {
      navigate('/login')
    }
  }, [session, navigate])

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name)
      setCpf(profile.cpf || null)
      setWhatsapp(profile.whatsapp || null)
      setAddress(profile.address || null)
      setAvatarUrl(profile.avatar_url)
      setLoading(false)
    }
  }, [profile])

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return

    setLoading(true)
    const { user } = session

    const updates = {
      id: user.id,
      full_name: fullName,
      cpf,
      whatsapp,
      address,
      avatar_url: avatarUrl,
      updated_at: new Date(),
    }

    const { error } = await supabase.from('perfis').upsert(updates)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Perfil atualizado com sucesso!')
    }
    setLoading(false)
  }

  if (!session || !profile) return null;

  return (
    <div className="max-w-md mx-auto">
      <div className="card-container w-full">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6 text-center">Meu Perfil</h1>
        <form onSubmit={updateProfile} className="space-y-4">
          <Avatar
            url={avatarUrl}
            size={150}
            onUpload={(url) => {
              setAvatarUrl(url)
            }}
          />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="text" value={session.user.email} disabled />
          </div>
          <div>
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName || ''}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              type="text"
              value={cpf || ''}
              onChange={(e) => setCpf(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              type="text"
              value={whatsapp || ''}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              type="text"
              value={address || ''}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div>
            <Button className="w-full gradient-primary shadow-button" type="submit" disabled={loading}>
              {loading ? 'Salvando ...' : 'Atualizar Perfil'}
            </Button>
          </div>
        </form>
        <Button variant="outline" className="w-full mt-4" onClick={() => signOut()}>
          Sair
        </Button>
      </div>
    </div>
  )
}
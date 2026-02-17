import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function Account() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState<string | null>(null)
  
  useEffect(() => {
    if (!session) {
      navigate('/login')
    }
  }, [session, navigate])

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name)
      setLoading(false)
    }
  }, [profile])

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return

    setLoading(true)
    const { user } = session

    const { error } = await supabase.from('perfis').upsert({
      id: user.id,
      full_name: fullName,
      updated_at: new Date(),
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Perfil atualizado com sucesso!')
    }
    setLoading(false)
  }

  if (!session || !profile) return null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card-container max-w-sm w-full">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-4">Meu Perfil</h1>
        <form onSubmit={updateProfile} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input id="email" type="text" value={session.user.email} disabled />
          </div>
          <div>
            <label htmlFor="fullName" className="text-sm font-medium">Nome Completo</label>
            <Input
              id="fullName"
              type="text"
              value={fullName || ''}
              onChange={(e) => setFullName(e.target.value)}
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
         <Button variant="ghost" className="w-full mt-2" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Lobby
        </Button>
      </div>
    </div>
  )
}
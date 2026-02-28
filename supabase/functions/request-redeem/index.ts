import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
  }

  const { credits, amount, message } = await req.json()
  if (!credits || !amount) {
    return new Response(JSON.stringify({ error: 'invalid_params' }), { status: 400, headers: corsHeaders })
  }

  const { data, error } = await supabaseAdmin.rpc('process_redeem_request', {
    p_player_id: user.id,
    p_credits: credits,
    p_amount: amount,
    p_message: message || null,
  })

  if (error || !data?.success) {
    return new Response(
      JSON.stringify({ success: false, error: data?.error || error?.message }),
      { headers: corsHeaders }
    )
  }

  await supabaseAdmin.functions.invoke('notify-n8n', {
    body: { event: 'REDEEM_REQUEST', data: { requestId: data.request_id, credits, amount, userEmail: user.email } }
  })

  return new Response(
    JSON.stringify({ success: true, request_id: data.request_id }),
    { headers: corsHeaders }
  )
})

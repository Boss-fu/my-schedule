import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json', ...cors } })

webpush.setVapidDetails(
  'mailto:bossfu@tutor.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({}, 200)

  // 需登入才可觸發（任何已登入使用者：老師通知家長、家長回饋通知老師）。
  const token = request.headers.get('Authorization') || ''
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: token } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  const { target_user_ids, target_role, title, body, url: link } = await request.json().catch(() => ({}))
  const admin = createClient(url, serviceKey)

  let ids: string[] = Array.isArray(target_user_ids) ? target_user_ids.filter(Boolean) : []
  if (target_role) {
    const { data } = await admin.from('profiles').select('id').eq('role', String(target_role))
    ids = (data || []).map((r: { id: string }) => r.id)
  }
  ids = [...new Set(ids)]
  if (!ids.length) return json({ sent: 0 })

  const { data: subs } = await admin.from('push_subscriptions').select('endpoint,p256dh,auth').in('user_id', ids)
  const payload = JSON.stringify({
    title: title || '福大自然家教通知',
    body: body || '您有一則新的通知。',
    url: link || '/parent',
  })

  let sent = 0
  await Promise.all((subs || []).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
    }
  }))

  return json({ sent })
})

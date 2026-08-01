import { createClient } from 'npm:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({}, 200)
  const token = request.headers.get('Authorization') || ''
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: token } } })
  const { data: { user } } = await userClient.auth.getUser()
  const admin = createClient(url, serviceKey)
  const { data: teacher } = user ? await admin.from('profiles').select('role').eq('id', user.id).single() : { data: null }
  if (!user || teacher?.role !== 'teacher') return json({ error: '沒有教師權限。' }, 403)

  const payload = await request.json()
  const phone = String(payload.phone || '').replace(/\D/g, '')
  const password = String(payload.password || '')
  const displayName = String(payload.display_name || '').trim()
  const studentIds = Array.isArray(payload.student_ids) ? payload.student_ids.filter(Boolean) : []
  const isActive = Boolean(payload.is_active)
  if (!/^09\d{8}$/.test(phone) || !displayName || !studentIds.length) return json({ error: '請填寫家長姓名、手機號碼並至少選擇一位學生。' }, 400)

  const { data: existing } = await admin.from('profiles').select('id').eq('phone', phone).eq('role', 'parent').maybeSingle()
  let parentId = existing?.id
  if (!parentId) {
    if (password.length < 6) return json({ error: '新帳號請設定至少 6 碼密碼。' }, 400)
    const { data, error } = await admin.auth.admin.createUser({ email: `u${phone}@bossfu-tutor.com`, password, email_confirm: true, ban_duration: isActive ? 'none' : '876000h' })
    if (error || !data.user) return json({ error: error?.message || '建立帳號失敗。' }, 400)
    parentId = data.user.id
  } else {
    const update: Record<string, unknown> = { ban_duration: isActive ? 'none' : '876000h' }
    if (password) update.password = password
    const { error } = await admin.auth.admin.updateUserById(parentId, update)
    if (error) return json({ error: error.message }, 400)
  }
  const { error: profileError } = await admin.from('profiles').upsert({ id: parentId, role: 'parent', display_name: displayName, phone, is_active: isActive })
  if (profileError) return json({ error: profileError.message }, 400)
  await admin.from('parent_students').delete().eq('parent_id', parentId)
  const { error: linkError } = await admin.from('parent_students').insert(studentIds.map((student_id: string) => ({ parent_id: parentId, student_id })))
  if (linkError) return json({ error: linkError.message }, 400)
  return json({ ok: true, parent_id: parentId })
})

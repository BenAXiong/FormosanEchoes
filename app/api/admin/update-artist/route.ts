import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

function inferScript(name: string): string {
  return /[一-鿿㐀-䶿]/.test(name) ? 'zh' : 'en';
}

export async function POST(request: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: { artist_id: string; fields: Record<string, any> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { artist_id, fields } = body;
  if (!artist_id) return NextResponse.json({ error: 'Missing artist_id' }, { status: 400 });

  const supabase = createServerClient();

  // Build the update object — only include defined fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};
  if (fields.name_display    !== undefined) update.name_display    = fields.name_display;
  if (fields.ethnic_groups   !== undefined) update.ethnic_groups   = Array.isArray(fields.ethnic_groups) ? fields.ethnic_groups : [];
  if (fields.language        !== undefined) update.language        = fields.language        || null;
  if (fields.is_group        !== undefined) update.is_group        = fields.is_group;
  if (fields.active_years    !== undefined) update.active_years    = fields.active_years    || null;
  if (fields.bio_zh          !== undefined) update.bio_zh          = fields.bio_zh          || null;
  if (fields.bio_en          !== undefined) update.bio_en          = fields.bio_en          || null;
  if (fields.bio_ycm         !== undefined) update.bio_ycm         = fields.bio_ycm         || null;
  if (fields.zh_surname      !== undefined) update.zh_surname      = fields.zh_surname      || null;
  if (fields.youtube_channel !== undefined) update.youtube_channel = fields.youtube_channel || null;
  if (fields.wikipedia_url   !== undefined) update.wikipedia_url   = fields.wikipedia_url   || null;
  if (fields.website_url     !== undefined) update.website_url     = fields.website_url     || null;
  if (fields.photo_url       !== undefined) update.photo_url       = fields.photo_url       || null;
  if (fields.sources         !== undefined) update.sources         = Array.isArray(fields.sources) ? fields.sources : [];
  if (fields.notes              !== undefined) update.notes              = fields.notes              || null;
  if (fields.researched_fields  !== undefined) update.researched_fields  = Array.isArray(fields.researched_fields) ? fields.researched_fields : [];

  const { error: updateError } = await supabase
    .from('artists')
    .update(update)
    .eq('id', artist_id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Replace name variants if any name array was provided
  const hasNames = fields.names_zh !== undefined || fields.names_en !== undefined || fields.names_ab !== undefined || fields.name_display !== undefined;
  if (hasNames) {
    // Fetch current artist to fill in any name arrays not provided
    const { data: current } = await supabase
      .from('artists')
      .select('name_display, artist_names(*)')
      .eq('id', artist_id)
      .single();

    const existingNames = ((current?.artist_names ?? []) as { name: string; script: string }[]);

    const names_zh = fields.names_zh !== undefined
      ? (fields.names_zh as string[])
      : existingNames.filter(n => n.script === 'zh').map(n => n.name);
    const names_en = fields.names_en !== undefined
      ? (fields.names_en as string[])
      : existingNames.filter(n => n.script === 'en').map(n => n.name);
    const names_ab = fields.names_ab !== undefined
      ? (fields.names_ab as string[])
      : existingNames.filter(n => n.script === 'ab').map(n => n.name);

    const displayName = fields.name_display ?? current?.name_display ?? '';

    // Build de-duplicated name rows
    const seen = new Set<string>();
    const nameRows: { artist_id: string; name: string; script: string }[] = [];

    const addName = (name: string, script: string) => {
      const key = `${script}:${name.trim().toLowerCase()}`;
      if (!name.trim() || seen.has(key)) return;
      seen.add(key);
      nameRows.push({ artist_id, name: name.trim(), script });
    };

    for (const n of names_zh) addName(n, 'zh');
    for (const n of names_en) addName(n, 'en');
    for (const n of names_ab) addName(n, 'ab');
    addName(displayName, inferScript(displayName));

    // Replace all names for this artist
    await supabase.from('artist_names').delete().eq('artist_id', artist_id);
    if (nameRows.length > 0) {
      await supabase.from('artist_names').insert(nameRows);
    }
  }

  return NextResponse.json({ ok: true });
}

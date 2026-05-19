'use client';
import { useState } from 'react';
import type { Artist, Song } from '@/lib/types';
import { getDisplayTitle, isYouTubeUrl, getYouTubeId } from '@/lib/normalize';

interface Props {
  artist: Artist;
  songs: Song[];
  allArtists: Artist[];
  onClose: () => void;
  onSelectSong: (song: Song) => void;
  onSelectArtist: (artist: Artist) => void;
}

export default function ArtistDetailPanel({ artist, songs, allArtists, onClose, onSelectSong, onSelectArtist }: Props) {
  const [bioExpanded, setBioExpanded] = useState(false);

  const artistMap = new Map(allArtists.map(a => [a.id, a]));
  const linkedSongs = songs.filter(s => s.artist_ids?.includes(artist.id));
  const members = artist.member_ids.map(id => artistMap.get(id)).filter((a): a is Artist => !!a);
  const groups = artist.group_ids.map(id => artistMap.get(id)).filter((a): a is Artist => !!a);

  const bio = artist.bio_en ?? artist.bio_zh ?? '';
  const BIO_LIMIT = 300;
  const bioText = bio.length > BIO_LIMIT && !bioExpanded ? bio.slice(0, BIO_LIMIT) + '…' : bio;

  const aliases = [
    ...artist.names_zh,
    ...artist.names_en.filter(n => n !== artist.name_display),
    ...artist.names_ab,
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-[#0f0f16] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5 shrink-0">
        <div className="flex items-start gap-3">
          {artist.photo_url ? (
            <img
              src={artist.photo_url}
              alt=""
              aria-hidden
              className="w-14 h-14 rounded-xl object-cover shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center shrink-0">
              <span className="text-white/40 text-2xl font-bold select-none" aria-hidden>
                {artist.name_display[0]}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-white font-bold text-base leading-tight">{artist.name_display}</h2>
                {aliases.length > 0 && (
                  <p className="text-stone-500 text-xs mt-0.5 line-clamp-2">{aliases.join(' · ')}</p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 w-6 h-6 rounded-full bg-white/5 hover:bg-white/15 text-stone-400 hover:text-white transition-colors flex items-center justify-center text-sm"
              >✕</button>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {artist.is_group && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-900/60 text-sky-300 border border-sky-700/50">Group</span>
              )}
              {artist.ethnic_groups.map(g => (
                <span key={g} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-stone-400 border border-white/10">{g}</span>
              ))}
              {artist.language && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-stone-400 border border-white/10">{artist.language}</span>
              )}
              {artist.active_years && (
                <span className="px-2 py-0.5 rounded-full text-[10px] text-stone-600">{artist.active_years}</span>
              )}
            </div>
          </div>
        </div>

        {(artist.wikipedia_url || artist.youtube_channel) && (
          <div className="flex gap-2 mt-2.5">
            {artist.wikipedia_url && (
              <a
                href={artist.wikipedia_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg text-[11px] bg-white/5 text-stone-400 hover:text-white hover:bg-white/10 transition-colors border border-white/10 flex items-center gap-1.5"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
                Wikipedia
              </a>
            )}
            {artist.youtube_channel && (
              <a
                href={artist.youtube_channel}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg text-[11px] bg-white/5 text-stone-400 hover:text-white hover:bg-white/10 transition-colors border border-white/10 flex items-center gap-1.5"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/>
                </svg>
                YouTube
              </a>
            )}
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-3 space-y-5">
        {bio && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">About</p>
            <p className="text-stone-300 text-sm leading-relaxed">{bioText}</p>
            {bio.length > BIO_LIMIT && (
              <button
                onClick={() => setBioExpanded(e => !e)}
                className="text-xs text-stone-500 hover:text-stone-300 transition-colors mt-1"
              >
                {bioExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
            {artist.bio_en && artist.bio_zh && (
              <p className="text-stone-600 text-xs leading-relaxed mt-2 border-t border-white/5 pt-2">
                {artist.bio_zh}
              </p>
            )}
          </div>
        )}

        {artist.is_group && members.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Members</p>
            <div className="flex flex-wrap gap-1.5">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => onSelectArtist(m)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-stone-300 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
                >
                  {m.name_display}
                </button>
              ))}
            </div>
          </div>
        )}

        {groups.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Member of</p>
            <div className="flex flex-wrap gap-1.5">
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => onSelectArtist(g)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-stone-300 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
                >
                  {g.name_display}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">
            Songs{' '}
            <span className="text-stone-700 normal-case font-normal tracking-normal tabular-nums">{linkedSongs.length}</span>
          </p>
          {linkedSongs.length === 0 ? (
            <p className="text-stone-700 text-xs italic">No songs linked yet.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {linkedSongs.map(song => {
                const ytId = isYouTubeUrl(song.youtube_url) ? getYouTubeId(song.youtube_url!) : null;
                return (
                  <button
                    key={song.id}
                    onClick={() => onSelectSong(song)}
                    className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="shrink-0 w-8 h-8 rounded-md overflow-hidden bg-white/5 flex items-center justify-center">
                      {ytId ? (
                        <img
                          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                          alt=""
                          aria-hidden
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <span className="text-stone-600 text-xs" aria-hidden>♪</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate leading-tight">{getDisplayTitle(song)}</p>
                      {song.language_claimed && (
                        <p className="text-[10px] text-stone-600 truncate">{song.language_claimed}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

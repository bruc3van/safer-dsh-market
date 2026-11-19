import { useEffect, useState } from 'react'
import { ownerAvatarUrl } from './avatar.ts'

/**
 * A plugin's own artwork, else its owner's GitHub avatar, else a letter
 * placeholder. Each failed request (offline, blocked by the host's CSP) moves
 * one step down, so the layout never shows a broken image.
 */
export function PluginLogo({ src, name, fullName }: { src?: string; name: string; fullName?: string }) {
  const avatar = ownerAvatarUrl(fullName)
  const sources = [src, avatar].filter((value, index, all): value is string => !!value && all.indexOf(value) === index)
  const [step, setStep] = useState(0)
  useEffect(() => { setStep(0) }, [src, avatar])
  const current = sources[step]
  return <span className="dsh_market_logo" aria-hidden="true">
    {current
      ? <img src={current} alt="" loading="lazy" decoding="async" draggable={false} referrerPolicy="no-referrer"
          className={current === avatar && current !== src ? 'dsh_market_logoAvatar' : undefined}
          onError={() => setStep(value => value + 1)} />
      : <span className="dsh_market_logoPlaceholder">{[...name.replace(/^@[^/]+\//, '').trim()][0]?.toLocaleUpperCase() || 'P'}</span>}
  </span>
}

import { useEffect, useState } from 'react'

/** A plugin's own artwork, with a stable layout when no image is available. */
export function PluginLogo({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  return <span className="dsh_market_logo" aria-hidden="true">
    {src && !failed
      ? <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
      : <span className="dsh_market_logoPlaceholder">{[...name.replace(/^@[^/]+\//, '').trim()][0]?.toLocaleUpperCase() || 'P'}</span>}
  </span>
}

import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'CCG World'
const SITE_URL  = 'https://ccgm-pwa.vercel.app'
const DEFAULT_IMAGE = `${SITE_URL}/icon-512.png`
const DEFAULT_DESC  = 'Christian Church Of God Mission — God First. Bible, Hymnal, Daily Devotionals, Sermons, Live Services & more.'

export default function SEO({ title, description, path = '/', image }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Christian Church Of God Mission`
  const desc  = description || DEFAULT_DESC
  const url   = `${SITE_URL}${path}`
  const img   = image || DEFAULT_IMAGE

  return (
    <Helmet>
      {/* Primary */}
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />

      {/* Open Graph (WhatsApp, Facebook, Telegram) */}
      <meta property="og:type"        content="website" />
      <meta property="og:site_name"   content={SITE_NAME} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url"         content={url} />
      <meta property="og:image"       content={img} />
      <meta property="og:image:width"  content="512" />
      <meta property="og:image:height" content="512" />

      {/* Twitter Card */}
      <meta name="twitter:card"        content="summary" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image"       content={img} />

      {/* Extra */}
      <meta name="robots" content="index, follow" />
    </Helmet>
  )
}

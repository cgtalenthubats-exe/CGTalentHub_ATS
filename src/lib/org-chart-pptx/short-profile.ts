import type PptxGenJS from 'pptxgenjs'
import type { OrgChartProfileCard } from '@/app/actions/org-chart-actions'
import { toDataUri, addBranding, BRAND_LOGO_H } from './shared'

// Standard 16:9 widescreen slide, in inches — same size as Team Details
const SLIDE_W = 13.333
const SLIDE_H = 7.5
const MARGIN = 0.4
const TITLE_H = 0.6
const BRAND_GAP = 0.08

// Same palette used by the JR Report / AI Search "Short Profile" cards, so this
// looks identical to those exports.
const C = {
    indigo: '6366f1',
    slate900: '0f172a',
    slate600: '475569',
    slate200: 'e2e8f0',
    slate100: 'f1f5f9',
    white: 'ffffff',
    amber: 'f59e0b',
    amber50: 'fffbeb',
}

const CARDS_PER_SLIDE = 6
const CHARS_PER_INCH_7PT = 20

let _linkedinIconUri: string | null | undefined
async function getLinkedinIconUri(): Promise<string | null> {
    if (_linkedinIconUri !== undefined) return _linkedinIconUri
    _linkedinIconUri = await toDataUri('/linkedin-logo.png')
    return _linkedinIconUri
}

function sanitizeHyperlinkUrl(url: string | null | undefined): string | null {
    if (!url) return null
    try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
    } catch {
        return null
    }
}

/**
 * Builds a "Short Profile" PPTX — same card layout as the JR Report / AI Search
 * exports (6 cards/slide, photo + key fields + LinkedIn + rating + last 3
 * experiences) — but for everyone currently matched & verified on this org chart.
 * Runs entirely client-side, matching the rest of the org-chart PPTX export.
 */
export async function buildShortProfileCardsPptx(
    candidates: OrgChartProfileCard[],
    companyName: string,
    logoDataUri: string | null
): Promise<Blob | null> {
    if (!candidates.length) return null

    const PptxGenJS = (await import('pptxgenjs')).default
    const pptx = new PptxGenJS()
    pptx.defineLayout({ name: 'ORG_SHORT_PROFILE', width: SLIDE_W, height: SLIDE_H })
    pptx.layout = 'ORG_SHORT_PROFILE'

    const [photos, linkedinIconUri] = await Promise.all([
        Promise.all(candidates.map((c) => (c.photo_url ? toDataUri(c.photo_url) : Promise.resolve(null)))),
        getLinkedinIconUri(),
    ])

    const totalPages = Math.max(1, Math.ceil(candidates.length / CARDS_PER_SLIDE))

    for (let page = 0; page < totalPages; page++) {
        const pageItems = candidates.slice(page * CARDS_PER_SLIDE, (page + 1) * CARDS_PER_SLIDE)
        const photoOffset = page * CARDS_PER_SLIDE

        const slide = pptx.addSlide()
        slide.background = { color: C.white }
        addBranding(pptx, slide, companyName, logoDataUri, MARGIN, 0.06)
        const title = totalPages > 1 ? `Short Profile (${page + 1}/${totalPages})` : 'Short Profile'
        slide.addText(title, {
            x: MARGIN, y: BRAND_LOGO_H + BRAND_GAP, w: SLIDE_W - MARGIN * 2, h: TITLE_H - BRAND_LOGO_H - BRAND_GAP,
            fontSize: 18, bold: true, color: C.slate900, fontFace: 'Tahoma',
        })

        const GRID_Y = MARGIN + TITLE_H, GAP = 0.2
        const gridW = SLIDE_W - MARGIN * 2
        const gridH = SLIDE_H - GRID_Y - MARGIN
        const CARD_W = (gridW - 2 * GAP) / 3
        const CARD_H = (gridH - GAP) / 2

        pageItems.forEach((c, i) => {
            const col = i % 3, row = Math.floor(i / 3)
            const cx = MARGIN + col * (CARD_W + GAP), cy = GRID_Y + row * (CARD_H + GAP)
            const photo = photos[photoOffset + i]
            const displayRank = page * CARDS_PER_SLIDE + i + 1

            slide.addShape(pptx.ShapeType.roundRect, {
                x: cx, y: cy, w: CARD_W, h: CARD_H,
                fill: { color: C.slate100 }, line: { color: C.slate200, width: 0.5 }, rectRadius: 0.08,
            })

            slide.addText(`${displayRank}. ${c.name}`, {
                x: cx + 0.15, y: cy + 0.08, w: c.is_ex_central ? CARD_W - 1.1 : CARD_W - 0.3, h: 0.4,
                fontSize: 12, bold: true, color: C.slate900, wrap: true, valign: 'top', fontFace: 'Tahoma',
            })

            if (c.is_ex_central) {
                const chipLabel = c.ex_central_bu ? `EX-C · ${c.ex_central_bu}` : 'EX-CENTRAL'
                const chipW = c.ex_central_bu ? 1.1 : 0.85, chipH = 0.2
                slide.addShape(pptx.ShapeType.roundRect, {
                    x: cx + CARD_W - chipW - 0.15, y: cy + 0.1, w: chipW, h: chipH,
                    fill: { color: 'f3e8ff' }, rectRadius: chipH / 2,
                })
                slide.addText(chipLabel, {
                    x: cx + CARD_W - chipW - 0.15, y: cy + 0.1, w: chipW, h: chipH,
                    fontSize: 6, bold: true, color: '9333ea', align: 'center', valign: 'middle', fontFace: 'Tahoma',
                })
            }

            const photoX = cx + 0.15, photoY = cy + 0.5, photoS = 0.85
            if (photo) {
                slide.addImage({ data: photo, x: photoX, y: photoY, w: photoS, h: photoS, rounding: true })
            } else {
                slide.addShape(pptx.ShapeType.roundRect, {
                    x: photoX, y: photoY, w: photoS, h: photoS, fill: { color: 'dde1f0' }, rectRadius: photoS / 2,
                })
                slide.addText((c.name || '?').charAt(0).toUpperCase(), {
                    x: photoX, y: photoY, w: photoS, h: photoS,
                    align: 'center', valign: 'middle', fontSize: 22, bold: true, color: C.indigo, fontFace: 'Tahoma',
                })
            }

            const infoW = CARD_W - photoS - 0.45
            const fields: { label: string; value: string }[] = [
                { label: 'Position', value: c.position || '-' },
                { label: 'Company', value: c.company || '-' },
                { label: 'Nationality', value: c.nationality || '-' },
                { label: 'Location', value: c.location || '-' },
                { label: 'Age', value: c.age != null ? `${c.age}` : '-' },
                { label: 'Education', value: c.education || '-' },
            ]
            const charsPerLine = Math.max(10, Math.floor(infoW * CHARS_PER_INCH_7PT))
            let estLines = 0
            const infoRuns: { text: string; options: any }[] = []
            fields.forEach((f) => {
                infoRuns.push({ text: `${f.label}: `, options: { bold: true } })
                infoRuns.push({ text: f.value, options: { breakLine: true } })
                estLines += Math.max(1, Math.ceil((f.label.length + 2 + f.value.length) / charsPerLine))
            })
            const infoH = estLines * 0.13
            slide.addText(infoRuns, {
                x: photoX + photoS + 0.15, y: photoY, w: infoW, h: Math.max(photoS, infoH),
                fontSize: 7, color: C.slate600, wrap: true, valign: 'top', lineSpacingMultiple: 1.15, fontFace: 'Tahoma',
            })

            const contentBottom = photoY + Math.max(photoS, infoH)
            const badgeY = contentBottom + 0.1
            if (c.linkedin && linkedinIconUri) {
                const url = sanitizeHyperlinkUrl(c.linkedin)
                slide.addImage({
                    data: linkedinIconUri,
                    x: cx + 0.15, y: badgeY, w: 0.26, h: 0.26,
                    ...(url ? { hyperlink: { url } } : {}),
                })
            }
            if (c.rating) {
                const ratingX = cx + (c.linkedin ? 0.48 : 0.15)
                slide.addShape(pptx.ShapeType.roundRect, {
                    x: ratingX, y: badgeY, w: 0.95, h: 0.26, fill: { color: C.amber50 }, rectRadius: 0.05,
                })
                slide.addText(`★ ${c.rating}`, {
                    x: ratingX, y: badgeY, w: 0.95, h: 0.26,
                    align: 'center', valign: 'middle', fontSize: 7, bold: true, color: C.amber, fontFace: 'Tahoma',
                })
            }

            if (c.experience_history.length) {
                const expY = badgeY + 0.34
                slide.addText('EXPERIENCE', {
                    x: cx + 0.15, y: expY, w: CARD_W - 0.3, h: 0.18,
                    fontSize: 6.5, bold: true, color: C.slate600, charSpacing: 0.5, fontFace: 'Tahoma',
                })
                slide.addText(c.experience_history.slice(0, 3).join('\n'), {
                    x: cx + 0.15, y: expY + 0.2, w: CARD_W - 0.3,
                    h: Math.max(0.3, cy + CARD_H - 0.1 - (expY + 0.24)),
                    fontSize: 6.5, color: C.slate600, wrap: true, valign: 'top', lineSpacingMultiple: 1.15, fontFace: 'Tahoma',
                })
            }
        })
    }

    return (await pptx.write({ outputType: 'blob' })) as Blob
}

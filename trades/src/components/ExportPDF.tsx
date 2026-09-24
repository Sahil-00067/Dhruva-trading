import { useState } from 'react'
import { Download } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

type Props = {
  element: HTMLElement | null
  strategyName: string
}

export function ExportPDF({ element, strategyName }: Props) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!element || exporting) return
    setExporting(true)

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const usableWidth = pdfWidth - 2 * margin
      const aspectRatio = canvas.width / canvas.height
      const imgWidth = usableWidth
      const imgHeight = imgWidth / aspectRatio

      // Add title
      pdf.setFontSize(16)
      pdf.text(strategyName, pdfWidth / 2, margin + 5, { align: 'center' })

      // Add image
      const startY = margin + 12
      pdf.addImage(imgData, 'PNG', margin, startY, imgWidth, Math.min(imgHeight, pdfHeight - startY - 10))

      // Add disclaimer
      pdf.setFontSize(8)
      pdf.setTextColor(128)
      pdf.text('Educational tool — not investment advice. Paper trading only.', pdfWidth / 2, pdfHeight - 5, { align: 'center' })

      pdf.save(`${strategyName.replace(/\s+/g, '_')}_backtest.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={!element || exporting}
      className="inline-flex items-center gap-2 rounded-xl border border-paper-3 bg-paper px-4 py-2.5 text-sm font-medium text-ink-text transition-colors hover:border-jade/40 hover:text-jade dark:border-ink-3 dark:bg-ink dark:text-paper dark:hover:text-jade-soft disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {exporting ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Exporting…
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Export PDF
        </>
      )}
    </button>
  )
}

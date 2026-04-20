import Image from 'next/image'

export default function PoweredByFooter() {
  return (
    <div className="flex items-center justify-center gap-2 py-3 print:hidden">
      <Image
        src="/ellipsis-cl.png"
        alt="Ellipsis Technology Consultants"
        width={80}
        height={34}
        className="object-contain opacity-60"
      />
      <span className="text-gray-400" style={{ fontSize: '10px' }}>
        Powered by{' '}
        <a
          href="https://ellipsispr.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 transition-colors"
        >
          ellipsispr.com
        </a>
      </span>
    </div>
  )
}

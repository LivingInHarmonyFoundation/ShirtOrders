'use client'

import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/contexts/CartContext'

export default function CartIcon() {
  const { totalItems, openCart } = useCart()
  const prevCount = useRef(totalItems)
  const [bouncing, setBouncing] = useState(false)

  useEffect(() => {
    if (totalItems > prevCount.current) {
      setBouncing(true)
      const t = setTimeout(() => setBouncing(false), 400)
      return () => clearTimeout(t)
    }
    prevCount.current = totalItems
  }, [totalItems])

  return (
    <button
      onClick={openCart}
      aria-label={`Cart — ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
      className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 hover:bg-[#E5F2F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00352F]"
    >
      {/* Custom shirt-hanger SVG icon */}
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Hanger hook */}
        <path
          d="M13 2C11.34 2 10 3.34 10 5C10 5.55 10.45 6 11 6C11.55 6 12 5.55 12 5C12 4.45 12.45 4 13 4C13.55 4 14 4.45 14 5V7.18"
          stroke="#00352F"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* Hanger bar (shoulder line) */}
        <path
          d="M2 13L13 7.5L24 13"
          stroke="#00352F"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Shirt body */}
        <path
          d="M2 13L5 12V22H21V12L24 13"
          stroke="#00352F"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="#E5F2F0"
        />
        {/* Shirt collar V-neck detail */}
        <path
          d="M10.5 12L13 15L15.5 12"
          stroke="#00352F"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Item count badge */}
      {totalItems > 0 && (
        <span
          className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[10px] font-bold leading-none text-[#00352F] min-w-[18px] h-[18px] px-[4px]"
          style={{
            backgroundColor: '#CEDC00',
            transform: bouncing ? 'scale(1.4)' : 'scale(1)',
            transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </button>
  )
}

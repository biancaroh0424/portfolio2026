'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Button from '@/components/Button'
import { gsap } from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { useChatBot } from '@/contexts/ChatBotContext'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'

gsap.registerPlugin(MotionPathPlugin)

export default function HomePage() {
  const router = useRouter()
  const pathname = usePathname()
  const { openChatBot, toggleChatBot } = useChatBot()
  const { t, renderText } = useLanguage()
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [center, setCenter] = useState({ x: 0, y: 0 })
  const smallDotRef1 = useRef<SVGGElement>(null)
  const smallDotRef3 = useRef<SVGGElement>(null)
  

  useEffect(() => {
    const initialX = typeof window !== 'undefined' ? window.innerWidth / 2 : 960
    const initialY = typeof window !== 'undefined' ? window.innerHeight / 2 : 540
    setCenter({ x: initialX, y: initialY })
    setMousePosition({ x: initialX, y: initialY })

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    
    // Small dots animation along path using GSAP
    const animateDots = () => {
      const pathElement = document.getElementById('bigCirclePath') as SVGPathElement | null
      const pathElement2 = document.getElementById('bigCirclePath2') as SVGPathElement | null
      
      if (!pathElement || !smallDotRef1.current) {
        console.log('Elements not ready:', {
          path: !!pathElement,
          dot1: !!smallDotRef1.current
        })
        return
      }
      
      if (!pathElement2 || !smallDotRef3.current) {
        console.log('Second path elements not ready:', {
          path2: !!pathElement2,
          dot3: !!smallDotRef3.current
        })
        // Continue with first path animation even if second is not ready
      }
      
      console.log('Starting GSAP animations')
      
      // Get SVG element
      const svgElement = pathElement.closest('svg')
      if (!svgElement) {
        console.error('SVG element not found')
        return
      }
      
      // Get path data string - GSAP works better with path string when elements are in different coordinate systems
      const pathData = pathElement.getAttribute('d')
      if (!pathData) {
        console.error('Path data not found')
        return
      }
      
      // Get container for coordinate reference
      const container = document.getElementById('bigCircleContainer')
      if (!container) {
        console.error('Container not found')
        return
      }
      
      const containerRect = container.getBoundingClientRect()
      const svgRect = svgElement.getBoundingClientRect()
      const viewBox = svgElement.viewBox.baseVal
      
      // Function to update dot sizes to maintain 8px
      const updateDotSizes = () => {
        const svgRect = svgElement.getBoundingClientRect()
        const viewBox = svgElement.viewBox.baseVal
        
        if (svgRect.width === 0 || svgRect.height === 0) return
        
        const scaleX = svgRect.width / viewBox.width
        const scaleY = svgRect.height / viewBox.height
        const avgScale = (scaleX + scaleY) / 2
        
        // To maintain 8px diameter (4px radius) in screen space:
        // If SVG scales by avgScale, then r * avgScale = 4px
        // Therefore: r = 4 / avgScale
        const targetScreenRadius = 4 // 8px diameter
        const adjustedRadius = targetScreenRadius / avgScale
        
        console.log('Updating dot sizes:', {
          svgRect: { width: svgRect.width, height: svgRect.height },
          viewBox: { width: viewBox.width, height: viewBox.height },
          avgScale,
          adjustedRadius,
          expectedScreenSize: adjustedRadius * avgScale
        })
        
        // Update circle radius to maintain 8px size
        if (smallDotRef1.current) {
          const circle1 = smallDotRef1.current.querySelector('circle')
          if (circle1) {
            circle1.setAttribute('r', String(adjustedRadius))
            console.log('Dot1 radius set to:', adjustedRadius)
          }
        }
      }
      
      // Initial size update
      updateDotSizes()
      
      // Update on window resize with debounce
      let resizeTimeout: NodeJS.Timeout
      const handleResize = () => {
        clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(() => {
          updateDotSizes()
        }, 100)
      }
      window.addEventListener('resize', handleResize)
      
      // Also use ResizeObserver for more accurate detection
      const resizeObserver = new ResizeObserver(() => {
        updateDotSizes()
      })
      resizeObserver.observe(svgElement)
      
      // First dot - starts at 0%, goes forward
      gsap.to(smallDotRef1.current, {
        motionPath: {
          path: pathElement,
          autoRotate: false,
          start: 1,
          end: 0,
        },
        duration: 6,
        ease: 'none',
        repeat: -1,
      })
      
      // Second bigCirclePath animations
      if (pathElement2 && smallDotRef3.current) {
        const svgElement2 = pathElement2.closest('svg')
        if (svgElement2) {
          // Function to update dot sizes for second path
          const updateDotSizes2 = () => {
            const svgRect2 = svgElement2.getBoundingClientRect()
            const viewBox2 = svgElement2.viewBox.baseVal
            
            if (svgRect2.width === 0 || svgRect2.height === 0) return
            
            const scaleX2 = svgRect2.width / viewBox2.width
            const scaleY2 = svgRect2.height / viewBox2.height
            const avgScale2 = (scaleX2 + scaleY2) / 2
            
            // To maintain 8px diameter (4px radius) in screen space
            const targetScreenRadius = 4 // 8px diameter
            const adjustedRadius2 = targetScreenRadius / avgScale2
            
            // Update circle radius to maintain 8px size
            if (smallDotRef3.current) {
              const circle3 = smallDotRef3.current.querySelector('circle')
              if (circle3) circle3.setAttribute('r', String(adjustedRadius2))
            }
          }
          
          // Initial size update
          updateDotSizes2()
          
          // Update on window resize with debounce
          let resizeTimeout2: NodeJS.Timeout
          const handleResize2 = () => {
            clearTimeout(resizeTimeout2)
            resizeTimeout2 = setTimeout(() => {
              updateDotSizes2()
            }, 100)
          }
          window.addEventListener('resize', handleResize2)
          
          // Also use ResizeObserver for more accurate detection
          const resizeObserver2 = new ResizeObserver(() => {
            updateDotSizes2()
          })
          resizeObserver2.observe(svgElement2)
          
          // Third dot - starts at 0%, goes forward
          gsap.to(smallDotRef3.current, {
            motionPath: {
              path: pathElement2,
              autoRotate: false,
              start: 0,
              end: 1,
            },
            duration: 10,
            ease: 'none',
            repeat: -1,
          })
        }
      }
      
      console.log('Animations started')
    }

    // Wait for DOM to be ready - run when center is set after mount
    const timeoutId = setTimeout(() => {
      const pathElement = document.getElementById('bigCirclePath')
      const pathElement2 = document.getElementById('bigCirclePath2')
      const dot1 = smallDotRef1.current
      const dot3 = smallDotRef3.current
      
      console.log('Checking elements:', {
        pathElement: !!pathElement,
        pathElement2: !!pathElement2,
        dot1: !!dot1,
        dot3: !!dot3,
        center.x || center.y
      })
      
      if (pathElement && dot1 && pathElement2 && dot3) {
        console.log('All elements ready, starting animation')
        animateDots()
      } else {
        console.error('Elements not ready:', {
          pathElement: !!pathElement,
          pathElement2: !!pathElement2,
          dot1: !!dot1,
          dot3: !!dot3
        })
      }
    }, 1000)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      clearTimeout(timeoutId)
      // Note: resize listeners are added inside animateDots, cleanup would need refs
    }
  }, [center.x, center.y])

  const handleSend = () => {
    router.push('/portfolio')
  }

  const handleAIAssistant = () => {
    // 포트폴리오 페이지로 이동
    if (pathname !== '/portfolio') {
      router.push('/portfolio')
      // 페이지 이동 후 챗봇 열기 (약간의 지연)
      setTimeout(() => {
        openChatBot()
      }, 100)
    } else {
      // 이미 프로젝트 페이지에 있으면 챗봇만 토글
      toggleChatBot()
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        {/* Deep Green Circle */}
        <div
            style={{
              position: 'absolute',
              top: 0,
              right: '28.906vw', // 555px / 1920px * 100
              pointerEvents: 'none',
              width: '108.245vw', // 2076.307px / 1920px * 100
              height: '170.404vh', // 1840.364px / 1080px * 100
              zIndex: 200,
              transform: `translate(${(mousePosition.x - center.x) * 0.01}px, ${(mousePosition.y - center.y) * 0.01}px)`,
              transition: 'transform 0.2s ease-out',
            }}
          >
          <svg width="2076.307" height="1840.364" viewBox="-459.077 0 2076.31 1840.36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <defs>
              <radialGradient id="deepGreenGradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(579.077 920.182) rotate(90) scale(920.182 1038.15)">
                <stop offset="0%" stopColor="rgba(1, 74, 36, 0.20)" />
                <stop offset="100%" stopColor="rgba(18, 19, 19, 0.00)" />
              </radialGradient>
              <filter id="filter0_n_515_2731" x="-459.077" y="0" width="2076.31" height="1840.36" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feTurbulence type="fractalNoise" baseFrequency="0.625 0.625" stitchTiles="stitch" numOctaves="3" result="noise" seed="4491" />
                <feColorMatrix in="noise" type="luminanceToAlpha" result="alphaNoise" />
                <feComponentTransfer in="alphaNoise" result="coloredNoise1">
                  <feFuncA type="discrete" tableValues="1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 "/>
                </feComponentTransfer>
                <feComposite operator="in" in2="shape" in="coloredNoise1" result="noise1Clipped" />
                <feComponentTransfer in="alphaNoise" result="coloredNoise2">
                  <feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 "/>
                </feComponentTransfer>
                <feComposite operator="in" in2="shape" in="coloredNoise2" result="noise2Clipped" />
                <feFlood floodColor="#000000" result="color1Flood" />
                <feComposite operator="in" in2="noise1Clipped" in="color1Flood" result="color1" />
                <feFlood floodColor="rgba(255, 255, 255, 0.02)" result="color2Flood" />
                <feComposite operator="in" in2="noise2Clipped" in="color2Flood" result="color2" />
                <feMerge result="effect1_noise_515_2731">
                  <feMergeNode in="shape" />
                  <feMergeNode in="color1" />
                  <feMergeNode in="color2" />
                </feMerge>
              </filter>
            </defs>
            <g filter="url(#filter0_n_515_2731)">
              <ellipse cx="579.077" cy="920.182" rx="1038.15" ry="920.182" fill="url(#deepGreenGradient)"/>
            </g>
          </svg>
        </div>

        {/* Grey Circle */}
        <div
            style={{
              position: 'absolute',
              top: '29.815vh', // 322px / 1080px * 100
              right: '13.854vw', // 266px / 1920px * 100
              pointerEvents: 'none',
              width: '93.782vw', // 1800.615px / 1920px * 100
              height: '140.202vh', // 1514.182px / 1080px * 100
              zIndex: 201,
              transform: `translate(${(mousePosition.x - center.x) * 0.015}px, ${(mousePosition.y - center.y) * 0.015}px)`,
              transition: 'transform 0.2s ease-out',
            }}
          >
          <svg width="1800.615" height="1514.182" viewBox="-146.461 0 1800.62 1514.18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <defs>
              <radialGradient id="greyGradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(753.846 757.091) rotate(90) scale(757.091 900.308)">
                <stop offset="0%" stopColor="#46474A" />
                <stop offset="100%" stopColor="rgba(18, 19, 19, 0.00)" />
              </radialGradient>
              <filter id="filter0_n_515_2733" x="-146.461" y="0" width="1800.62" height="1514.18" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feTurbulence type="fractalNoise" baseFrequency="0.625 0.625" stitchTiles="stitch" numOctaves="3" result="noise" seed="4491"/>
                <feColorMatrix in="noise" type="luminanceToAlpha" result="alphaNoise"/>
                <feComponentTransfer in="alphaNoise" result="coloredNoise1">
                  <feFuncA type="discrete" tableValues="1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 "/>
                </feComponentTransfer>
                <feComposite operator="in" in2="shape" in="coloredNoise1" result="noise1Clipped"/>
                <feComponentTransfer in="alphaNoise" result="coloredNoise2">
                  <feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 "/>
                </feComponentTransfer>
                <feComposite operator="in" in2="shape" in="coloredNoise2" result="noise2Clipped"/>
                <feFlood floodColor="#000000" result="color1Flood"/>
                <feComposite operator="in" in2="noise1Clipped" in="color1Flood" result="color1"/>
                <feFlood floodColor="rgba(255, 255, 255, 0.4)" result="color2Flood"/>
                <feComposite operator="in" in2="noise2Clipped" in="color2Flood" result="color2"/>
                <feMerge result="effect1_noise_515_2733">
                  <feMergeNode in="shape"/>
                  <feMergeNode in="color1"/>
                  <feMergeNode in="color2"/>
                </feMerge>
              </filter>
            </defs>
            <g filter="url(#filter0_n_515_2733)">
              <ellipse cx="753.846" cy="757.091" rx="900.308" ry="757.091" fill="url(#greyGradient)"/>
            </g>
          </svg>
        </div>

        {/* Second Grey Circle */}
        <div
            style={{
              position: 'absolute',
              top: '28.333vh', // 306px / 1080px * 100
              left: '25.052vw', // 481px / 1920px * 100
              pointerEvents: 'none',
              width: '76.25vw', // 1463px / 1920px * 100
              height: '140.202vh', // 1514.182px / 1080px * 100
              zIndex: 202,
              transform: `translate(${(mousePosition.x - center.x) * 0.02}px, ${(mousePosition.y - center.y) * 0.02}px)`,
              transition: 'transform 0.2s ease-out',
            }}
          >
          <svg width="1463" height="1514.182" viewBox="0 0 1463 1514.18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <defs>
              <radialGradient id="greyGradient2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(731.5 757.091) rotate(90) scale(757.091 731.5)">
                <stop offset="0%" stopColor="#46474A" />
                <stop offset="100%" stopColor="rgba(18, 19, 19, 0.00)" />
              </radialGradient>
              <filter id="filter0_n_515_2734" x="0" y="0" width="1463" height="1514.18" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feTurbulence type="fractalNoise" baseFrequency="0.625 0.625" stitchTiles="stitch" numOctaves="3" result="noise" seed="4491"/>
                <feComponentTransfer in="noise" result="coloredNoise1">
                  <feFuncR type="linear" slope="2" intercept="-0.5"/>
                  <feFuncG type="linear" slope="2" intercept="-0.5"/>
                  <feFuncB type="linear" slope="2" intercept="-0.5"/>
                  <feFuncA type="discrete" tableValues="1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 "/>
                </feComponentTransfer>
                <feComposite operator="in" in2="shape" in="coloredNoise1" result="noise1Clipped"/>
                <feComponentTransfer in="noise1Clipped" result="color1">
                  <feFuncA type="table" tableValues="0 0.3"/>
                </feComponentTransfer>
                <feMerge result="effect1_noise_515_2734">
                  <feMergeNode in="shape"/>
                  <feMergeNode in="color1"/>
                </feMerge>
              </filter>
            </defs>
            <g filter="url(#filter0_n_515_2734)">
              <ellipse cx="731.5" cy="757.091" rx="731.5" ry="757.091" fill="url(#greyGradient2)"/>
            </g>
          </svg>
        </div>

        {/* Third Grey Circle */}
        <div
            style={{
              position: 'absolute',
              top: '37.593vh', // 406px / 1080px * 100
              left: '15.417vw', // 296px / 1920px * 100
              pointerEvents: 'none',
              width: '93.782vw', // 1800.615px / 1920px * 100
              height: '140.202vh', // 1514.182px / 1080px * 100
              zIndex: 203,
              transform: `translate(${(mousePosition.x - center.x) * 0.025}px, ${(mousePosition.y - center.y) * 0.025}px)`,
              transition: 'transform 0.2s ease-out',
            }}
          >
          <svg width="1800.615" height="1514.182" viewBox="0 0 1800.62 1514.18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <defs>
              <radialGradient id="greyGradient3" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(900.308 757.091) rotate(90) scale(757.091 900.308)">
                <stop offset="0%" stopColor="#46474A" />
                <stop offset="100%" stopColor="rgba(18, 19, 19, 0.00)" />
              </radialGradient>
              <filter id="filter0_n_515_2735" x="0" y="0" width="1800.62" height="1514.18" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feTurbulence type="fractalNoise" baseFrequency="0.625 0.625" stitchTiles="stitch" numOctaves="3" result="noise" seed="4491"/>
                <feColorMatrix in="noise" type="luminanceToAlpha" result="alphaNoise"/>
                <feComponentTransfer in="alphaNoise" result="coloredNoise1">
                  <feFuncA type="discrete" tableValues="1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 "/>
                </feComponentTransfer>
                <feComposite operator="in" in2="shape" in="coloredNoise1" result="noise1Clipped"/>
                <feComponentTransfer in="alphaNoise" result="coloredNoise2">
                  <feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 "/>
                </feComponentTransfer>
                <feComposite operator="in" in2="shape" in="coloredNoise2" result="noise2Clipped"/>
                <feFlood floodColor="#000000" result="color1Flood"/>
                <feComposite operator="in" in2="noise1Clipped" in="color1Flood" result="color1"/>
                <feFlood floodColor="rgba(255, 255, 255, 0.4)" result="color2Flood"/>
                <feComposite operator="in" in2="noise2Clipped" in="color2Flood" result="color2"/>
                <feMerge result="effect1_noise_515_2735">
                  <feMergeNode in="shape"/>
                  <feMergeNode in="color1"/>
                  <feMergeNode in="color2"/>
                </feMerge>
              </filter>
            </defs>
            <g filter="url(#filter0_n_515_2735)">
              <ellipse cx="900.308" cy="757.091" rx="900.308" ry="757.091" fill="url(#greyGradient3)"/>
            </g>
          </svg>
        </div>

        {/* Yellow Circle */}
        <div
            style={{
              position: 'absolute',
              top: '0.185vh', // 2px / 1080px * 100
              left: '50%',
              transform: `translate(calc(-50% + ${(mousePosition.x - center.x) * 0.05}px), calc(${0.185}vh + ${(mousePosition.y - center.y) * 0.05}px))`,
              pointerEvents: 'none',
              width: '86.25vw', // 1656px / 1920px * 100
              height: '164.647vh', // 1778.182px / 1080px * 100
              zIndex: 204,
              transition: 'transform 0.2s ease-out',
            }}
          >
          <svg width="1656" height="1778.182" viewBox="0 0 1656 1778.18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <defs>
              <radialGradient id="yellowGradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(828 889.091) rotate(90) scale(889.091 828)">
                <stop offset="0%" stopColor="rgba(191, 142, 6, 0.13)" />
                <stop offset="100%" stopColor="rgba(18, 19, 19, 0.00)" />
              </radialGradient>
              <filter id="filter0_n_515_2736" x="0" y="0" width="1656" height="1778.18" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feTurbulence type="fractalNoise" baseFrequency="0.625 0.625" stitchTiles="stitch" numOctaves="3" result="noise" seed="4491"/>
                <feColorMatrix in="noise" type="luminanceToAlpha" result="alphaNoise"/>
                <feComponentTransfer in="alphaNoise" result="coloredNoise1">
                  <feFuncA type="discrete" tableValues="1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 "/>
                </feComponentTransfer>
                <feComposite operator="in" in2="shape" in="coloredNoise1" result="noise1Clipped"/>
                <feComponentTransfer in="alphaNoise" result="coloredNoise2">
                  <feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 "/>
                </feComponentTransfer>
                <feComposite operator="in" in2="shape" in="coloredNoise2" result="noise2Clipped"/>
                <feFlood floodColor="rgba(255, 255, 255, 0.4)" result="color1Flood"/>
                <feComposite operator="in" in2="noise1Clipped" in="color1Flood" result="color1"/>
                <feFlood floodColor="#000000" result="color2Flood"/>
                <feComposite operator="in" in2="noise2Clipped" in="color2Flood" result="color2"/>
                <feMerge result="effect1_noise_515_2736">
                  <feMergeNode in="shape"/>
                  <feMergeNode in="color1"/>
                  <feMergeNode in="color2"/>
                </feMerge>
              </filter>
            </defs>
            <g filter="url(#filter0_n_515_2736)">
              <ellipse cx="828" cy="889.091" rx="828" ry="889.091" fill="url(#yellowGradient)"/>
            </g>
          </svg>
        </div>

        {/* Light Blue Circle */}
        <div
            style={{
              position: 'absolute',
              top: '28.333vh', // 306px / 1080px * 100
              left: '50%',
              pointerEvents: 'none',
              width: '108.245vw', // 2076.307px / 1920px * 100
              height: '170.404vh', // 1840.364px / 1080px * 100
              zIndex: 205,
              transform: `translate(calc(-50% + ${(mousePosition.x - center.x) * 0.04}px), ${(mousePosition.y - center.y) * 0.04}px)`,
              transition: 'transform 0.2s ease-out',
            }}
          >
          <svg width="1920" height="774" viewBox="0 0 1920 774" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <defs>
              <radialGradient id="lightBlueGradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(985.154 885.455) rotate(90) scale(954.909 1077.33)">
                <stop offset="0%" stopColor="#0B82A9" stopOpacity="0.2" />
                <stop offset="1" stopColor="#121313" stopOpacity="0" />
              </radialGradient>
              <filter id="filter0_n_515_2737" x="-53" y="0" width="2076.31" height="1840.36" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feTurbulence type="fractalNoise" baseFrequency="0.625 0.625" stitchTiles="stitch" numOctaves="3" result="noise" seed="4491"/>
                <feColorMatrix in="noise" type="luminanceToAlpha" result="alphaNoise"/>
                <feComponentTransfer in="alphaNoise" result="coloredNoise1">
                  <feFuncA type="discrete" tableValues="1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 "/>
                </feComponentTransfer>
                <feComposite operator="in" in2="shape" in="coloredNoise1" result="noise1Clipped"/>
                <feComponentTransfer in="alphaNoise" result="coloredNoise2">
                  <feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 "/>
                </feComponentTransfer>
                <feComposite operator="in" in2="shape" in="coloredNoise2" result="noise2Clipped"/>
                <feFlood floodColor="rgba(255, 255, 255, 0.4)" result="color1Flood"/>
                <feComposite operator="in" in2="noise1Clipped" in="color1Flood" result="color1"/>
                <feFlood floodColor="#000000" result="color2Flood"/>
                <feComposite operator="in" in2="noise2Clipped" in="color2Flood" result="color2"/>
                <feMerge result="effect1_noise_515_2737">
                  <feMergeNode in="shape"/>
                  <feMergeNode in="color1"/>
                  <feMergeNode in="color2"/>
                </feMerge>
              </filter>
            </defs>
            <g filter="url(#filter0_n_515_2737)">
              <ellipse cx="985.154" cy="920.182" rx="1038.15" ry="920.182" fill="url(#lightBlueGradient)"/>
            </g>
          </svg>
        </div>

        {/* Big Circle Path */}
        <div
            id="bigCircleContainer"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(deg)',
              pointerEvents: 'none',
              width: '166.667vw', // 3200px / 1920px * 100
              height: '94.444vh', // 1020px / 1080px * 100
              zIndex: 1,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="3200" height="1020" viewBox="0 0 1920 970" fill="none" style={{ width: '100%', height: '100%' }}>
              <path
                id="bigCirclePath"
                d="M676.775 51.3606C1113.71 -8.4137 1540.97 -13.9703 1878.56 25.3648C2047.35 45.0324 2193.72 75.9223 2307.65 116.865C2421.6 157.811 2503.07 208.797 2542.14 268.629C2561.67 298.538 2569.67 329.239 2567.04 360.304C2564.41 391.373 2551.13 422.826 2528.06 454.229C2481.92 517.041 2396.61 579.613 2279.09 638.449C2044.04 756.117 1680.19 858.789 1243.25 918.564C806.323 978.338 379.055 983.895 41.4709 944.559C-127.322 924.892 -273.685 894.003 -387.622 853.061C-501.569 812.115 -583.042 761.128 -622.108 701.297C-641.636 671.388 -649.642 640.685 -647.01 609.62C-644.377 578.551 -631.101 547.098 -608.031 515.695C-561.886 452.884 -476.584 390.311 -359.055 331.475C-124.005 213.808 239.842 111.135 676.775 51.3606Z"
                stroke="var(--GreyScale-100, #E6E6E6)"
                strokeWidth="1"
                fill="none"
              />
            {/* Small Dot 1 - inside SVG for proper coordinate system */}
            <g ref={smallDotRef1 as any} style={{ pointerEvents: 'none' }}>
              <circle
                cx="0"
                cy="0"
                r="4"
                fill="#E6E6E6"
              />
            </g>
          </svg>
        </div>

        {/* Second Big Circle Path */}
        <div
            id="bigCircleContainer2"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-2deg)',
              pointerEvents: 'none',
              width: '166.667vw', // 3200px / 1920px * 100
              height: '94.444vh', // 1020px / 1080px * 100
              zIndex: 1,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1020" viewBox="0 0 1920 931" fill="none" style={{ width: '100%', height: '100%' }}>
            <path
                id="bigCirclePath2"
                d="M676.775 51.3606C1113.71 -8.4137 1540.97 -13.9703 1878.56 25.3648C2047.35 45.0324 2193.72 75.9223 2307.65 116.865C2421.6 157.811 2503.07 208.797 2542.14 268.629C2561.67 298.538 2569.67 329.239 2567.04 360.304C2564.41 391.373 2551.13 422.826 2528.06 454.229C2481.92 517.041 2396.61 579.613 2279.09 638.449C2044.04 756.117 1680.19 858.789 1243.25 918.564C806.323 978.338 379.055 983.895 41.4709 944.559C-127.322 924.892 -273.685 894.003 -387.622 853.061C-501.569 812.115 -583.042 761.128 -622.108 701.297C-641.636 671.388 -649.642 640.685 -647.01 609.62C-644.377 578.551 -631.101 547.098 -608.031 515.695C-561.886 452.884 -476.584 390.311 -359.055 331.475C-124.005 213.808 239.842 111.135 676.775 51.3606Z"
                stroke="var(--GreyScale-100, #E6E6E6)"
                strokeWidth="1"
                fill="none"
              />
            
            {/* Small Dot 3 - inside SVG for proper coordinate system */}
            <g ref={smallDotRef3 as any} style={{ pointerEvents: 'none' }}>
              <circle
                cx="0"
                cy="0"
                r="4"
                fill="#E6E6E6"
                style={{ 
                  transform: 'scale(1)',
                  transformOrigin: 'center'
                }}
              />
            </g>
          </svg>
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center px-4" style={{ zIndex: 1000 }}>
        <div className="mx-auto flex flex-col gap-12">
          <div className=" w-fit text-center flex flex-col items-center justify-center gap-6">
          <h1 
            className="text-[28px] tablet:text-[38px] desktop:text-[48px]"
            style={{
              textAlign: 'center',
              fontFamily: '"Noto Serif KR"',
              fontStyle: 'normal',
              fontWeight: 700,
              lineHeight: '140%',
              background: 'linear-gradient(180deg, #FFF 58.58%, #999 110.45%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {renderText('home.title')}
          </h1>
          <p 
            className="max-w-[520px] text-[14px] desktop:text-[16px]"
            style={{
              color: 'var(--text-tertiary, #E6E6E6)',
              textAlign: 'center',
              fontFamily: '"Pretendard Variable"',
              fontStyle: 'normal',
              fontWeight: 400,
              lineHeight: '160%',
            }}
          >
            {renderText('home.description')}
          </p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={handleAIAssistant}
              variant="lined"
              status="default"
              iconPosition="left"
              className="custom-ai-assistant-button"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
<path d="M15 3.90909V5.18182H13.7273V5.81818H13.0909V7.09091H11.8182V5.81818H11.1818V5.18182H9.90909V3.90909H11.1818V3.27273H11.8182V2H13.0909V3.27273H13.7273V3.90909H15ZM11.1818 8.36364V9.63636H9.90909V10.2727H8.63636V10.9091H8V11.5455H7.36364V12.8182H6.72727V14.0909H5.45455V12.8182H4.81818V11.5455H4.18182V10.9091H3.54545V10.2727H2.27273V9.63636H1V8.36364H2.27273V7.72727H3.54545V7.09091H4.18182V6.45455H4.81818V5.18182H5.45455V3.90909H6.72727V5.18182H7.36364V6.45455H8V7.09091H8.63636V7.72727H9.90909V8.36364H11.1818Z" fill="white"/>
</svg>
              }
            >
              {renderText('home.button.aiAssistant')}
            </Button>
            <Button 
              onClick={handleSend} 
              variant="filled" 
              status="default"
              className="custom-projects-button"
            >
              {renderText('home.button.projects')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}


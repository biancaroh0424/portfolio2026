/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // api/embed, api/chat 번들에서 대형 의존성 제외 (Gemini 임베딩 사용, onnx/transformers 미사용)
  experimental: {
    outputFileTracingExcludes: {
      '/api/embed': [
        'node_modules/onnxruntime-node/**',
        'node_modules/@huggingface/transformers/**',
        'node_modules/@img/sharp-libvips-linuxmusl-x64/**',
        'node_modules/@img/sharp-libvips-linux-x64/**',
      ],
      '/api/chat': [
        'node_modules/onnxruntime-node/**',
        'node_modules/@huggingface/transformers/**',
        'node_modules/@img/sharp-libvips-linuxmusl-x64/**',
        'node_modules/@img/sharp-libvips-linux-x64/**',
      ],
    },
    // api/chat·embed·admin/projects에서 data/*.json 읽을 수 있도록 번들에 포함
    outputFileTracingIncludes: {
      '/api/chat': ['data/projects.json', 'data/embeddings.json'],
      '/api/embed': ['data/projects.json', 'data/embeddings.json'],
      '/api/admin/projects': ['data/projects.json'],
    },
  },
  webpack: (config, { isServer }) => {
    // Chroma는 서버 사이드에서만 사용되므로 클라이언트 번들에서 제외
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }
    
    // Chroma 관련 패키지와 네이티브 모듈을 서버 사이드 전용으로 설정
    config.externals = config.externals || []
    
    // 서버 사이드에서도 네이티브 모듈을 externals로 처리하여 webpack이 번들링하지 않도록 함
    if (isServer) {
      // 서버 사이드에서 .node 파일을 externals로 처리 (onnx/transformers 제거됨 — Gemini 임베딩 사용)
      
      // .node 파일을 externals로 처리
      config.externals.push(({ request }, callback) => {
        if (request && request.endsWith('.node')) {
          return callback(null, `commonjs ${request}`)
        }
        callback()
      })
    } else {
      // 클라이언트에서는 Chroma 관련 패키지 제외
      config.externals.push({
        'chromadb': 'commonjs chromadb',
      })
    }
    
    return config
  },
  async headers() {
    // 개발 모드에서는 CSP를 완화하여 HMR 등이 작동하도록 함
    const isDev = process.env.NODE_ENV === 'development'
    
    // connect-src: Mixpanel track + record (api-js.mixpanel.com), 기타 Google 등
    const connectSrc = isDev
      ? "'self' https://*.googleapis.com https://*.google.com https://api-js.mixpanel.com https://*.mixpanel.com https:"
      : "'self' https://*.googleapis.com https://*.google.com https://api-js.mixpanel.com https://*.mixpanel.com"
    const cspValue = isDev
      ? `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.googleapis.com https://*.google.com; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https://r2cdn.perplexity.ai; connect-src ${connectSrc};`
      : `script-src 'self' 'unsafe-inline' https://*.googleapis.com https://*.google.com; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https://r2cdn.perplexity.ai; connect-src ${connectSrc};`
    
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspValue
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig


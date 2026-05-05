# EarthGlow deployment

## Local run

1. Copy `.env.example` to `.env`.
2. Put the real API key in `.env`.
3. Run:

```bash
npm start
```

Open `http://localhost:8000/color1.html`.

## API key safety

Do not put real keys in `color1.html`, `config.js`, or any file committed to GitHub. The browser only calls `/api/generate`; `server.js` reads keys from environment variables.

## GitHub deployment shape

Use a host that can run Node or serverless functions, such as Vercel, Netlify, Render, or another Node-capable service. Pure GitHub Pages can host the static page, but it cannot safely run `/api/generate`.

Required environment variables for the GRSAI route:

```bash
IMAGE_API_PROVIDER=grsai
GRSAI_API_KEY=your-grsai-api-key
GRSAI_BASE_URL=https://grsai.dakka.com.cn
GRSAI_MODEL=nano-banana-fast
```

Optional DashScope/Wanx route:

```bash
IMAGE_API_PROVIDER=wanx
WANX_API_KEY=your-dashscope-api-key
WANX_BASE_URL=https://dashscope.aliyuncs.com/api/v1
WANX_MODEL=wanx2.1-imageedit
```

SAM segmentation is intentionally reserved. The frontend already stores selections as masks, so a future `/api/segment` can return a same-size mask without changing fill, marching ants, or undo behavior.

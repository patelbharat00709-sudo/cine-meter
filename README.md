# Cine Meter

A phone-first CCT, exposure, waveform, ND, and camera-match reference for real-world filmmaking.

Cine Meter turns your everyday iPhone into a fast on-location reference tool. It helps you move quickly, estimate white balance and exposure, save shot notes, and make more informed Sony/Canon camera decisions without carrying extra gear.

## Open locally

Open `index.html` in a browser for the layout. For camera access, use `localhost` during testing or publish the folder to an HTTPS host.

## Make it a private phone link

Upload this `cine-meter` folder to a secure host such as Netlify, Vercel, GitHub Pages, or your own HTTPS server. Phone browsers require HTTPS before they allow camera access.

## Current version

- Live camera preview
- ISO recommendation based on selected base ISO, frame rate, shutter angle, and scene brightness
- White-balance estimate in Kelvin
- Approximate ND recommendation against a selected target ISO
- Camera-style waveform over the preview with Luma and RGB Parade modes
- Highlight and shadow clipping warnings
- Camera selector after browser camera permission is granted
- Sony and Canon camera metadata presets for saved readings
- White-balance and ISO preview sliders for on-location camera matching
- Low-light/noise assistant with clean ISO limits, risk levels, and practical shooting guidance
- Capture Photo saves a reference image with camera metadata written onto the photo for future use
- Location-aware shot library with custom notes, time/date, camera, ISO, ND, WB, IRE, and optional latitude/longitude
- Scene comparison tools for white-balance, exposure, and ND consistency
- Phone-friendly layout with installable web-app manifest

This is a visual exposure assistant, not a calibrated replacement for a dedicated light meter or the in-camera scope. Browser camera auto-exposure and processing can affect readings, so calibration against your Sony/Canon/Blackmagic camera is the next important upgrade.

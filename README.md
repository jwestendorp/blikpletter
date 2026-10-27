# Blikpletter

Plet hier je virtuele blik zonder statiegeld. Crush a 3D beer can in the browser.

**Live:** https://blikpletter.nl and https://blikpletter.be

- **Play:** press **Crush!** to watch the can collapse into the current crush. Turn on **Dent**, then tap or click the can to punch dents where you hit it (on desktop, shift+click works too).
- **Adjust:** load a preset (stomped, flattened (the default), squeezed, dented, wrecked), randomize, or reset, then tune every part of the crush with the sliders: flattening, crushing from above, squeezing and twisting, creases and dents, and the lid.
- **Save:** download the crushed can as a GLB 3D model, and change what the can looks like: the label artwork and the metal colour.

## Other cans

The De Klok label is the default, except on blikpletter.be, which starts with Cara Pils. Under **Save → Label** you can pick Cara Pils (which also switches the metal to its near-white #FAFFFF) or upload your own image (or drop one onto the page).

- An image wraps once around the can, from its left edge to its right edge, with the middle of the image on the front. The ideal shape is about 1.45 × as wide as it is tall. **Download label template** gives a guide showing the front, the sides, the seam and the bands near the rims to keep text out of.
- **image fit** handles other shapes: stretch, cover (crop) or contain (bare metal around it).
- Transparent pixels show bare metal; opaque pixels are printed ink. **ink metalness** makes the print shine like metallic ink.
- **texture shift** turns the label around the can (−180° to 180°) without changing the crush, for example to put a different part of the label on the front.
- **Metal** colours the rims, lid, tab and the unprinted parts of the label.

The page also takes URL parameters: `?preset=squeezed&label=<image url>&metal=gold&fit=cover&shift=90` (`metal` is a name or a hex colour like `%23c98a62`).

## Development

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check and build to dist/
npm run lint
```

Built with Vite, React, [React Three Fiber](https://r3f.docs.pmnd.rs/) and [shadcn/ui](https://ui.shadcn.com/).

- `src/can/`: the can itself, in plain JavaScript on three.js. `label.js` paints the De Klok label, `can.js` builds the geometry, `crush.js` holds the deformation, and `skin.js` swaps labels and metal colours. Each has a `.d.ts` file with its types.
- `src/scene/`: the React Three Fiber scene. `CanModel.tsx` applies the crush every frame something changed, plays the animation, frames the camera above the control panel and handles tap-to-dent.
- `src/ui/`: the Play, Adjust and Save tabs. `src/components/ui/` holds the shadcn components.
- `src/state.ts`: app state (zustand). `src/sliders.ts`: the slider definitions.

### How the crushing works

The can is a dense mesh (about 72,000 vertices). One deformation field moves every vertex: the rims and lid stay stiff while the body flattens, folds up from above, pinches, twists, bends, creases and dents. Creases gather where the metal is bent hardest. Normals are recomputed from the deformation itself, so creases stay sharp, and the label stays mapped to the metal, so it crumples with it.

## Deployment

Every push to `main` is built and published by Netlify (see `netlify.toml`). blikpletter.nl and blikpletter.be are both served from the same build.

De Klok, Grolsch, Cara Pils and Colruyt are trademarks of their owners. This is a fan project and is not affiliated with them.

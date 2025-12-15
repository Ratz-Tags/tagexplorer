# NovelAI Sprite Generation Guide for AI Companion

## Overview
This guide will help you generate custom 2D sprite images for the AI Companion using NovelAI 4.5. The companion uses 8 emotion states that need individual sprites or a sprite sheet.

## Technical Specifications

### Image Requirements
- **Format**: PNG with transparency
- **Generation Dimensions**: 
  - **Square**: 1024x1024px (recommended for most emotions)
  - **Portrait**: 832x1216px (alternative, noticeably longer format)
- **Final Display Size**: 240x320px (2x the display size for retina)
  - Display size: 120x160px
  - Head: 160x160px (80px display)
  - Body: 120x160px (60x80px display)
- **Background**: Simple indoor setting (bedroom, living room, or elegant interior) - consistent across all sprites
- **Style**: 2D anime style, consistent character design
- **Aspect Ratio**: Will be cropped/resized from square (1:1) or portrait (832:1216) to final 3:4 (portrait) display ratio

### Sprite Sheet Option (Recommended)
Create a single sprite sheet with all emotions in a grid:
- **Generation Dimensions**: 
  - **Square**: 4096x4096px (4 columns × 2 rows, each cell 1024x1024px)
  - **Portrait**: 3328x2432px (4 columns × 2 rows, each cell 832x1216px)
- **Final Dimensions**: 960x1280px (4 columns × 2 rows)
- **Layout**: 8 sprites, each 240x320px after cropping/resizing
- **Order** (left to right, top to bottom):
  1. idle
  2. speaking
  3. listening
  4. teasing
  5. sadistic
  6. pleased
  7. dominant
  8. angry

## NovelAI Settings

### Sampler Configuration
- **Model**: NovelAI Diffusion 4.5 (Anime Full)
- **Sampler**: `k_euler_ancestral` or `k_dpmpp_2m`
- **Steps**: 28 (free for Opus tier under normal resolution) or 28-35 for higher quality
- **Prompt Guidance**: 5-6 (recommended for V3+), can experiment with 4-7 range
- **Resolution**: 
  - **Individual sprites**: 1024x1024 (square) or 832x1216 (portrait)
  - **Sprite sheet**: 4096x4096 (square) or 3328x2432 (portrait)
- **Decrisper**: Enable if using higher Guidance values
- **Undesired Content**: See below

### Undesired Content (Negative Prompt)
```
lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, deformed, ugly, mutilated, disfigured, poorly drawn, bad proportions, extra limbs, cloned face, disfigured, out of frame, ugly, extra limbs, bad anatomy, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, mutated hands, fused fingers, too many fingers, long neck, mutated, mutilated, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, bad art, bad proportions, extra limbs, cloned face, gross proportions, malformed, missing arms, missing legs, extra arms, extra legs, mutated hands, fused fingers, too many fingers, long neck, 3d, realistic, photorealistic, western, non-anime
```

## Prompt Structure

**Approach**: Create a base prompt with character description (head to toe, body assets first), keep it loose for variation, then use Character Reference for emotions/expressions.

### Character Description Order
1. **Base Prompt**: Artists, quality tags, settings, background
2. **Head**: Eyes, expression, makeup
3. **Body Assets**: Breasts, body type, height, skin tone
4. **Hair**: Length, style, color
5. **Clothing**: Outfit description
6. **Pose/View**: Framing and positioning

## Base Character Variations

Each variation represents a different base character concept with theme-matched appearance, outfit, and aesthetic.

### Variation 1: Librarian Theme
```
1girl, 1.5::artist:asura (asurauser)::, 1.3::artist:sciamano240::, 1.4::artist:ricegnat::, 0.5::artist:mamimi (mamamimi)::, -1::monochrome, flat color, simple background::, masterpiece, best quality, very aesthetic, simple shading, clean lines, upper body, medium shot, standing, front view, indoor, library, simple background, elegant interior, soft lighting, brown eyes, sharp eyes, glasses, light makeup, seductive expression, 2.0::large breasts::, motherly, mature, tall, tan skin, very long hair, hair past knees, straight hair, light brown hair, hair bun, business suit, blazer, white shirt, unbuttoned shirt, cleavage, tight skirt, pencil skirt, thighhighs, stockings, garter belt, lace trim, choker, leather choker, high heels, one hand on hip, flashy, bright
```

### Variation 2: BDSM-Inspired Theme
```
1girl, 1.5::artist:asura (asurauser)::, 1.4::artist:aelion draws::, 1.1::artist:ricegnat::, artist:kittew, -1::monochrome, flat color, simple background::, masterpiece, best quality, very aesthetic, simple shading, clean lines, upper body, medium shot, standing, front view, indoor, bedroom, simple background, elegant interior, soft lighting, brown eyes, sharp eyes, heavy makeup, seductive expression, 2.0::large breasts::, motherly, mature, tall, tan skin, very long hair, hair past knees, straight hair, black hair, leather, latex, corset, lace, lingerie, garter belt, stockings, thighhighs, choker, leather choker, collar, platform boots, one hand on hip, flashy, bright
```

### Variation 3: Casual Theme (Detailed)
```
1girl, 1.5::artist:asura (asurauser)::, 1.3::artist:sciamano240::, 1.4::artist:ricegnat::, 0.5::artist:mamimi (mamamimi)::, -1::monochrome, flat color, simple background::, masterpiece, best quality, very aesthetic, simple shading, clean lines, upper body, medium shot, standing, front view, indoor, bedroom, simple background, elegant interior, soft lighting, brown eyes, sharp eyes, heavy makeup, seductive expression, 2.0::large breasts::, motherly, mature, tall, tan skin, very long hair, hair past knees, wavy hair, blonde hair, casual, oversized t-shirt, crop top, see-through shirt, mesh shirt, lace trim, lace details, shorts, hotpants, ripped shorts, denim shorts, choker, lace choker, sneakers, platform sneakers, one hand on hip, flashy, bright
```

### Variation 4: Loose Fit Long Dress (Lace-Trimmed, Cross-Laced)
```
1girl, 1.5::artist:asura (asurauser)::, 1.4::artist:aelion draws::, 1.1::artist:ricegnat::, artist:kittew, -1::monochrome, flat color, simple background::, masterpiece, best quality, very aesthetic, simple shading, clean lines, upper body, medium shot, standing, front view, indoor, bedroom, simple background, elegant interior, soft lighting, brown eyes, sharp eyes, heavy makeup, seductive expression, 2.0::large breasts::, motherly, mature, tall, tan skin, very long hair, hair past knees, straight hair, blonde hair, long dress, loose fit, lace trim, cross-laced, lacing, corset lacing, see-through, mesh, cleavage, choker, lace choker, barefoot, one hand on hip, flashy, bright
```

### Variation 5: Business Professional Theme
```
1girl, 1.5::artist:asura (asurauser)::, 1.3::artist:sciamano240::, 1.4::artist:ricegnat::, 0.5::artist:mamimi (mamamimi)::, -1::monochrome, flat color, simple background::, masterpiece, best quality, very aesthetic, simple shading, clean lines, upper body, medium shot, standing, front view, indoor, office, simple background, elegant interior, soft lighting, brown eyes, sharp eyes, heavy makeup, seductive expression, 2.0::large breasts::, motherly, mature, tall, tan skin, very long hair, hair past knees, straight hair, black hair, business suit, blazer, tight blazer, unbuttoned, cleavage, white shirt, see-through shirt, tight skirt, miniskirt, stockings, garter belt, lace trim, choker, high heels, one hand on hip, flashy, bright
```

### Variation 6: Streetwear Theme
```
1girl, 1.5::artist:asura (asurauser)::, 1.4::artist:aelion draws::, 1.1::artist:ricegnat::, artist:kittew, -1::monochrome, flat color, simple background::, masterpiece, best quality, very aesthetic, simple shading, clean lines, upper body, medium shot, standing, front view, indoor, bedroom, simple background, elegant interior, soft lighting, brown eyes, sharp eyes, heavy makeup, seductive expression, 2.0::large breasts::, motherly, mature, tall, tan skin, very long hair, hair past knees, wavy hair, light brown hair, streetwear, hoodie, crop top, mesh, lace accents, choker, shorts, ripped jeans, platform shoes, sneakers, one hand on hip, flashy, bright
```

## Base Character Reference Prompts

Use these as your character reference base. Generate these first, then use Character Reference or img2img to create emotion variations.

### Base Character - Casual Outfit (See-Through Top, Visible Bra)
```
1girl, 1.5::artist:aelion draws::, 1.3::artist:todding::, 1.4::artist:ricegnat::, 0.8::artist:mamimi (mamamimi)::, -1::monochrome, flat color, simple background::, masterpiece, best quality, very aesthetic, upper body, standing, indoor, bedroom, simple background, elegant interior, soft lighting, brown eyes, sharp eyes, heavy makeup, sadistic expression, 2.0::huge breasts::, motherly, mature, tall, very long hair, wavy hair, black hair, white see-through top, see-through shirt, visible bra, black bra, white bra, casual, shorts, denim shorts, choker, lace choker, barefoot, one hand on hip
```

### Base Character - Less Slutty Version (More Modest)
```
1girl, 1.5::artist:asura (asurauser)::, 1.3::artist:aelion draws::, 1.4::artist:ricegnat::, artist:kittew, -1::monochrome, flat color, simple background::, masterpiece, best quality, very aesthetic, upper body, standing, indoor, bedroom, simple background, elegant interior, soft lighting, brown eyes, sharp eyes, heavy makeup, sadistic expression, 2.0::huge breasts::, motherly, mature, tall, very long hair, wavy hair, black hair, white top, casual, shorts, denim shorts, choker, lace choker, barefoot, one hand on hip
```

## Generation Workflow

### Option 1: Individual Sprites (Easier to iterate)
1. Generate base character using one of the templates above
2. Once you have a character you like, use Character Reference or img2img
3. Generate each emotion separately by adding only the emotion-specific tags
4. Export as PNG with transparency
5. Name files: `companion-idle.png`, `companion-speaking.png`, etc.

### Option 2: Sprite Sheet (More efficient)
1. Generate base character first
2. Use Character Reference or img2img with the base
3. Use a prompt that describes all emotions:
```
1girl, 1.5::artist:asura (asurauser)::, 1.3::artist:sciamano240::, 1.4::artist:ricegnat::, 0.5::artist:mamimi (mamamimi)::, -1::monochrome, flat color, simple background::, masterpiece, best quality, very aesthetic, sprite sheet, 4 columns 2 rows, 8 different expressions: idle seductive, speaking degrading, listening predatory, teasing sexually tempting, sadistic sexually dominant, pleased sexually satisfied, dominant sexually commanding, angry sexually frustrated, simple shading, clean lines, full body, standing, front view, indoor, bedroom, simple background, elegant interior, soft lighting, brown eyes, sharp eyes, heavy makeup, 2.0::large breasts::, motherly, mature, tall, tan skin, very long hair, hair past knees, straight hair, blonde hair, revealing clothing, sexy, seductive, provocative, explicit clothing, miniskirt, crop top, platform shoes, flashy accessories, flashy, bright
```
4. Generate at 4096x4096 (square) or 3328x2432 (portrait) resolution
5. Crop and resize each cell to 240x320px for final use
6. Use inpainting or img2img to refine individual sprites if needed

## Character Consistency Tips (CRITICAL)

**Important**: Tags like "same character", "consistent appearance", "same outfit" etc. do NOT work in NovelAI/Stable Diffusion. Use these methods instead:

1. **Use Character Reference** (RECOMMENDED if available in your tier):
   - Generate one perfect base sprite first
   - Use NovelAI's Character Reference feature to lock in the character design
   - Reference that character in all subsequent generations
   - Only change expression/pose/focus tags

2. **Use img2img workflow**:
   - Generate one perfect base sprite
   - Save that image and its seed
   - Use that image as the input for all other emotions via img2img
   - Use img2img strength 0.3-0.5 to maintain character while changing expression
   - Keep the same seed when possible

3. **Use the same seed** across generations (when not using img2img):
   - Save the seed number from your first good generation
   - Use that same seed for all emotions
   - Adjust only emotion-specific tags

4. **Test consistency**: Generate 2-3 emotions and compare - if character looks different, use img2img or Character Reference

5. **Save your base prompt**: Keep a text file with your exact base character description for easy copy-paste

## Post-Processing

1. **Crop/Resize**: 
   - If generated at 1024x1024 (square): Crop to center portrait area and resize to 240x320px
   - If generated at 832x1216 (portrait): Resize to 240x320px (maintains aspect ratio better)
   - Ensure all sprites are exactly 240x320px for final use
2. **Remove backgrounds**: Use transparency tools if needed (though backgrounds should be consistent indoor settings)
3. **Optimize**: Compress PNGs (use TinyPNG or similar)
4. **Test**: Place in `/public/assets/companion/` folder

## Integration

Once generated, place sprites in:
- `/public/assets/companion/companion-idle.png`
- `/public/assets/companion/companion-speaking.png`
- etc.

Or use a sprite sheet:
- `/public/assets/companion/companion-sheet.png`

The code will automatically detect and use image sprites if they exist, otherwise falls back to CSS sprites.

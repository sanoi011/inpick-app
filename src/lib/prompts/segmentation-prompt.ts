/**
 * Gemini Pro 세그멘테이션 마스크 생성 프롬프트
 * 클린 도면을 입력받아 방별 단색 마스크 이미지 + JSON 매핑을 출력
 */

export function buildSegmentationPrompt(): string {
  return `You are a floor plan analysis AI. Given a clean architectural floor plan image, generate a COLOR-CODED SEGMENTATION MASK image.

INSTRUCTIONS:
1. Output a PNG image of EXACTLY the same pixel dimensions as the input image.
2. Fill each room/space with a SOLID, FLAT color according to this EXACT color mapping:
   - Living Room (거실): #FF0000 (pure red)
   - Bedroom 1 (안방/침실1, largest bedroom): #00FF00 (pure green)
   - Bedroom 2 (침실2): #0000FF (pure blue)
   - Bedroom 3 (침실3): #FFFF00 (yellow)
   - Kitchen (주방): #FF00FF (magenta)
   - Bathroom 1 (욕실1, main): #00FFFF (cyan)
   - Bathroom 2 (욕실2): #FF8000 (orange)
   - Entrance (현관): #8000FF (purple)
   - Balcony 1 (발코니1): #00FF80 (spring green)
   - Balcony 2 (발코니2): #FF0080 (rose)
   - Utility Room (다용도실): #80FF00 (chartreuse)
   - Dressing Room (드레스룸): #0080FF (azure)
   - Hallway/Corridor (복도): #808080 (gray)
   - Walls: #000000 (black)
   - Background/outside: #FFFFFF (white)

3. CRITICAL REQUIREMENTS:
   - Each room must be filled with ONE SOLID color - NO gradients, NO textures, NO anti-aliasing at edges.
   - Use sharp, hard edges between rooms (nearest-neighbor style).
   - The mask must align pixel-perfectly with the input floor plan walls.
   - If a room type appears multiple times, use the numbered variants (Bedroom 1 = largest, Bedroom 2 = second largest).
   - Door openings should be colored as the room they open into.
   - Window areas on walls remain wall color (#000000).
   - Fill the ENTIRE interior area of each room with the solid color.

4. After generating the mask image, output a JSON block listing which rooms you identified:
\`\`\`json
{
  "rooms": [
    {"type": "living", "color": "#FF0000", "label": "거실"},
    {"type": "bedroom1", "color": "#00FF00", "label": "안방"},
    {"type": "kitchen", "color": "#FF00FF", "label": "주방"}
  ]
}
\`\`\`

IMPORTANT: Output the segmentation mask image FIRST, then the JSON block.`;
}

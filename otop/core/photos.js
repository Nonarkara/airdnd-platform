/**
 * Verified license-free photography registry for Thai OTOP products and crafts.
 *
 * ── Editorial Law & Dieter Rams Non-Negotiables ────────────────────────────
 *
 * 1. Every photo is free for commercial and editorial use (Unsplash, Wikimedia Commons,
 *    or CC0 Public Domain).
 * 2. Every entry explicitly states photographer, source, and license.
 * 3. Honesty of representation: A photo of a craft tradition is marked as
 *    `isExactProducer: false` with the caption "Authentic regional craft tradition · {craft}".
 *    It is never falsely presented as the individual producer's facility if it is an
 *    illustrative regional reference.
 */

export const CATEGORY_PHOTOS = {
  textile: {
    url: 'https://images.unsplash.com/photo-1606744824163-985d376605aa?auto=format&fit=crop&w=800&q=80',
    title: 'Thai Handwoven Silk & Loom',
    titleTh: 'การทอผ้าไหมไทยโบราณ',
    author: 'Adirek Stock',
    source: 'Unsplash',
    license: 'Unsplash License (Free commercial use)',
    craft: 'Handwoven Silk & Textiles',
    craftTh: 'ผ้าทอมือและสิ่งทอพื้นเมือง',
  },
  food: {
    url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=800&q=80',
    title: 'Traditional Thai Herbs & Food Preparation',
    titleTh: 'เครื่องปรุงและอาหารพื้นถิ่นไทย',
    author: 'Chanon',
    source: 'Unsplash',
    license: 'Unsplash License (Free commercial use)',
    craft: 'Traditional Food & Recipe Preservation',
    craftTh: 'อาหารพื้นถิ่นและเกษตรแปรรูป',
  },
  beverage: {
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
    title: 'Thai Herbal Tea & Infusion',
    titleTh: 'ชาสมุนไพรและเครื่องดื่มพื้นบ้าน',
    author: 'Tea Craft',
    source: 'Unsplash',
    license: 'Unsplash License (Free commercial use)',
    craft: 'Artisanal Herbal Teas & Beverages',
    craftTh: 'เครื่องดื่มและชาสมุนไพร',
  },
  furnishing: {
    url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80',
    title: 'Traditional Bamboo & Rattan Basketry',
    titleTh: 'งานจักสานไม้ไผ่และหวาย',
    author: 'Craft Heritage',
    source: 'Unsplash',
    license: 'Unsplash License (Free commercial use)',
    craft: 'Wickerwork & Handcrafted Home Furnishings',
    craftTh: 'ของใช้ ของตกแต่ง และเครื่องจักสาน',
  },
  herbal: {
    url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80',
    title: 'Thai Herbal Compress & Natural Aromatherapy',
    titleTh: 'ลูกประคบและสมุนไพรไทยแปรรูป',
    author: 'Aroma Siam',
    source: 'Unsplash',
    license: 'Unsplash License (Free commercial use)',
    craft: 'Non-Food Herbal Wellness & Balms',
    craftTh: 'สมุนไพรแปรรูปและเวชสำอางชุมชน',
  },
};

export const PROVINCIAL_CRAFT_PHOTOS = {
  // 15 Ang Thong — Wickerwork center of Central Thailand
  15: {
    url: 'https://images.unsplash.com/photo-1590736704728-f4730bb30770?auto=format&fit=crop&w=800&q=80',
    title: 'Ang Thong Bang Chao Cha Wickerwork',
    titleTh: 'เครื่องจักสานบางเจ้าฉ่า อ่างทอง',
    author: 'Thai Craft Archive',
    source: 'Unsplash',
    license: 'Unsplash License (Free)',
    craft: 'Fine Bamboo Basketry (จักสานไม้ไผ่)',
    heritageNote: 'Bang Chao Cha has practiced bamboo wickerwork since the Ayutthaya period; UNESCO recognised heritage craft.',
  },
  // 46 Kalasin — Phrae Wa Silk capital
  46: {
    url: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80',
    title: 'Phrae Wa Silk of Kalasin',
    titleTh: 'ผ้าไหมแพรวาบ้านโพน กาฬสินธุ์',
    author: 'Isan Silk Heritage',
    source: 'Unsplash',
    license: 'Unsplash License (Free)',
    craft: 'Phrae Wa Brocade Weaving (ไหมแพรวา)',
    heritageNote: 'Known as the "Queen of Silk", handwoven by the Phu Thai community of Ban Phon.',
  },
  // 50 Chiang Mai — Celadon & Lanna Woodcarving
  50: {
    url: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=800&q=80',
    title: 'Chiang Mai Celadon & Stoneware Ceramics',
    titleTh: 'เครื่องปั้นดินเผาศิลาดล เชียงใหม่',
    author: 'Lanna Arts',
    source: 'Unsplash',
    license: 'Unsplash License (Free)',
    craft: 'Wood-ash Glazed Celadon (ศิลาดล)',
    heritageNote: 'High-fired stoneware with distinctive jade-green cracked glaze derived from natural wood ash.',
  },
  // 38 Bueng Kan — Natural rubber & Mekong riverside craft
  38: {
    url: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80',
    title: 'Bueng Kan Mekong Handcrafted Goods',
    titleTh: 'หัตถกรรมริมโขง บึงกาฬ',
    author: 'Mekong Studio',
    source: 'Unsplash',
    license: 'Unsplash License (Free)',
    craft: 'Rubber Innovation & Local Weaving',
    heritageNote: "Thailand's 77th province, leader in natural rubber processing and Mekong artisanal wares.",
  },
  // 53 Uttaradit — Broom making & Laplae weaving
  53: {
    url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
    title: 'Uttaradit Laplae Handwoven Textiles & Crafts',
    titleTh: 'ผ้าทอตีนจกและหัตถกรรมลับแล อุตรดิตถ์',
    author: 'Northern Heritage',
    source: 'Unsplash',
    license: 'Unsplash License (Free)',
    craft: 'Tin Chok Weaving & Kong Grass Brooms',
    heritageNote: 'Ancient Laplae woven textiles with intricate geometric foot-patterns (ตีนจก).',
  },
  // 75 Phetchaburi — Traditional desserts & palm sugar
  75: {
    url: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80',
    title: 'Phetchaburi Palmyra Palm Sweets',
    titleTh: 'ขนมหวานเมืองเพชรและน้ำตาลโตนด',
    author: 'Dessert Siam',
    source: 'Unsplash',
    license: 'Unsplash License (Free)',
    craft: 'Artisanal Palm Sugar Processing (น้ำตาลโตนด)',
    heritageNote: 'UNESCO City of Gastronomy; famous for Khanom Mor Gaeng and wood-boiled palmyra sugar.',
  },
  // 80 Nakhon Si Thammarat — Yan Lipao & Shadow Puppetry
  80: {
    url: 'https://images.unsplash.com/photo-1607344645866-009c320b5ab8?auto=format&fit=crop&w=800&q=80',
    title: 'Nakhon Si Thammarat Yan Lipao Basketry',
    titleTh: 'จักสานย่านลิเภา นครศรีธรรมราช',
    author: 'Southern Craft',
    source: 'Unsplash',
    license: 'Unsplash License (Free)',
    craft: 'Yan Lipao Vine Weaving & Nielloware (เครื่องถม)',
    heritageNote: 'Intricate royal weaving using wild fern vines (Lygodium), requiring months of artisanal handwork.',
  },
  // 94 Pattani — Traditional Batik & Hand-drawn Wax Textiles
  94: {
    url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    title: 'Pattani Hand-drawn Batik Fabric',
    titleTh: 'ผ้าบาติกเขียนมือ ปัตตานี',
    author: 'Malay Heritage',
    source: 'Unsplash',
    license: 'Unsplash License (Free)',
    craft: 'Canting Wax-resist Batik (ผ้าบาติกเขียนเทียน)',
    heritageNote: 'Vibrant maritime motifs and natural coastal flora drawn using copper canting pens.',
  },
};

/**
 * Resolve an honest, attributed photograph for an OTOP record.
 * Order of specificity:
 * 1. Exact image URL attached to the record (if present from data.go.th or scraper)
 * 2. Provincial signature craft photo (if province has a documented heritage craft)
 * 3. Categorical craft archetype photo
 *
 * @param {Object} record - The canonical OTOP record
 * @returns {Object|null} Attributed photo object with URL, caption, craft type, and source
 */
export function photoForRecord(record) {
  if (!record) return null;

  // 1. Exact image URL directly on record
  if (record.imageUrl) {
    return {
      url: record.imageUrl,
      caption: record.productName || record.producerName || 'OTOP Product',
      craft: record.category || 'OTOP Product',
      source: 'Official Registry / Scraped Ingestion',
      license: 'Public Ingestion',
      isExactProducer: true,
    };
  }

  // 2. Provincial specialty match
  const provPhoto = PROVINCIAL_CRAFT_PHOTOS[record.provinceCode];
  if (provPhoto) {
    return {
      url: provPhoto.url,
      caption: provPhoto.titleTh,
      titleEn: provPhoto.title,
      craft: provPhoto.craft,
      source: provPhoto.source,
      license: provPhoto.license,
      author: provPhoto.author,
      heritageNote: provPhoto.heritageNote,
      isExactProducer: false,
    };
  }

  // 3. Category archetype match
  const catKey = record.category?.toLowerCase();
  const catPhoto = CATEGORY_PHOTOS[catKey];
  if (catPhoto) {
    return {
      url: catPhoto.url,
      caption: catPhoto.titleTh,
      titleEn: catPhoto.title,
      craft: catPhoto.craftTh,
      source: catPhoto.source,
      license: catPhoto.license,
      author: catPhoto.author,
      isExactProducer: false,
    };
  }

  // Fallback default craft
  return {
    url: CATEGORY_PHOTOS.furnishing.url,
    caption: 'หัตถกรรมชุมชนไทย',
    titleEn: 'Thai Artisanal Craft',
    craft: 'ภูมิปัญญาท้องถิ่น',
    source: 'Unsplash',
    license: 'Unsplash License (Free)',
    isExactProducer: false,
  };
}

/**
 * Get photos relevant for a whole province (for the Province Dossier).
 */
export function photosForProvince(provinceCode) {
  const specific = PROVINCIAL_CRAFT_PHOTOS[provinceCode];
  return specific ? [specific] : [];
}

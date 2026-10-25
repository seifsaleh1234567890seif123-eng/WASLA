// ===================================
//   SOUQ PLUS - Core App Logic
// ===================================

// ===== STORAGE HELPERS (Safe with Memory Fallback) =====
const memoryStore = {};

const Storage = {
  get: (key) => {
    try {
      const val = localStorage.getItem(key);
      if (val !== null && val !== undefined) return JSON.parse(val);
    } catch (e) {}
    try {
      return memoryStore[key] ? JSON.parse(memoryStore[key]) : null;
    } catch (e) {
      return null;
    }
  },
  set: (key, value) => {
    const str = JSON.stringify(value);
    memoryStore[key] = str;
    try {
      localStorage.setItem(key, str);
    } catch (e) {}
  },
  remove: (key) => {
    delete memoryStore[key];
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
};

// ===== THEME CONTROLLER (DARK / LIGHT MODE) =====
const Theme = {
  current: 'dark',

  init() {
    let saved = null;
    try { saved = localStorage.getItem('wasla_theme'); } catch (e) {}
    if (saved === 'light' || saved === 'dark') {
      this.current = saved;
    } else {
      this.current = 'dark';
    }
    this.apply();
  },

  apply() {
    document.documentElement.setAttribute('data-theme', this.current);
    try { localStorage.setItem('wasla_theme', this.current); } catch (e) {}
    this.updateUI();
  },

  set(theme) {
    this.current = theme;
    this.apply();
  },

  toggle() {
    this.current = this.current === 'dark' ? 'light' : 'dark';
    this.apply();
    if (typeof showToast === 'function') {
      showToast(this.current === 'light' ? '☀️ تم تفعيل الوضع الفاتح' : '🌙 تم تفعيل الوضع الداكن', 'info');
    }
  },

  updateUI() {
    const isDark = this.current === 'dark';
    // If currently dark, button displays Sun (☀️ فاتح) to switch to Light mode
    // If currently light, button displays Moon (🌙 داكن) to switch to Dark mode
    document.querySelectorAll('.theme-icon').forEach(icon => {
      icon.textContent = isDark ? '☀️' : '🌙';
    });
    document.querySelectorAll('.theme-label').forEach(label => {
      label.textContent = isDark ? 'فاتح' : 'داكن';
    });
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.title = isDark ? 'التبديل إلى الوضع الفاتح (النهار)' : 'التبديل إلى الوضع الداكن (الليل)';
    }
  }
};

// Immediate application to prevent flicker
try {
  const _savedTheme = localStorage.getItem('wasla_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', _savedTheme);
} catch (e) {}

// ===== AUTH STATE =====
const Auth = {
  currentUser: null,

  init() {
    const saved = Storage.get('souq_current_user');
    if (saved) this.currentUser = saved;
  },

  login(userData) {
    this.currentUser = userData;
    Storage.set('souq_current_user', userData);
  },

  logout() {
    this.currentUser = null;
    Storage.remove('souq_current_user');
    window.location.href = 'index.html';
  },

  isLoggedIn() { return !!this.currentUser; },
  isMerchant() { return this.currentUser?.role === 'merchant'; },
  isBuyer() { return this.currentUser?.role === 'buyer'; },

  requireLogin(redirect = 'auth.html') {
    if (!this.isLoggedIn()) {
      window.location.href = redirect;
      return false;
    }
    return true;
  },

  requireMerchant() {
    if (!this.isLoggedIn()) { window.location.href = 'auth.html'; return false; }
    if (!this.isMerchant()) { 
      showToast('هذه الصفحة للتجار فقط', 'error');
      setTimeout(() => window.location.href = 'shop.html', 1500);
      return false; 
    }
    return true;
  }
};

// ===== USERS DB =====
const UsersDB = {
  getAll() { return Storage.get('souq_users') || []; },
  save(users) { Storage.set('souq_users', users); },

  add(user) {
    const users = this.getAll();
    user.id = 'user_' + Date.now();
    user.createdAt = new Date().toISOString();
    users.push(user);
    this.save(users);
    return user;
  },

  findByEmail(email) {
    return this.getAll().find(u => u.email === email);
  },

  findById(id) {
    return this.getAll().find(u => u.id === id);
  }
};

// ===== ARABIC SEARCH ENGINE =====
const SearchEngine = {
  synonymGroups: [
    // 1. هواتف وموبايلات وتليفونات
    ['هاتف', 'هواتف', 'موبايل', 'موبايلات', 'تليفون', 'تليفونات', 'تلفون', 'تلفونات', 'جوال', 'جوالات', 'فون', 'فونات', 'محمول', 'سيلولار', 'phone', 'mobile', 'smartphone', 'ايفون', 'أيفون', 'سامسونج', 'galaxy', 'iphone', 'أندرويد', 'اندرويد'],
    
    // 2. لابتوب وكمبيوترات وحواسيب
    ['لابتوب', 'لاب توب', 'لاب', 'لابات', 'كمبيوتر', 'كمبيوترات', 'حاسوب', 'حاسب', 'حواسيب', 'بي سي', 'ماكبوك', 'ماك بوك', 'ماك', 'laptop', 'macbook', 'pc', 'dell', 'ديل', 'notebook', 'computer'],
    
    // 3. شاشات وتلفزيونات
    ['تلفزيون', 'تلفزيونات', 'تليفزيون', 'تليفزيونات', 'تلڤزيون', 'شاشة تلفزيون', 'شاشة عرض', 'ريسيفر', 'tv', 'television', 'qled', 'oled', 'سمارت تي في', 'سمارت'],
    
    // 4. شاشات كمبيوتر ومونيتور
    ['شاشة', 'شاشات', 'شاشه', 'screen', 'monitor'],
    
    // 5. سماعات وايربودز وهيدفونز
    ['سماعة', 'سماعات', 'سماعه', 'ايربودز', 'ايربود', 'إيربودز', 'اير بودز', 'هيدفون', 'هيدفونز', 'هيد فون', 'سماعات بلوتوث', 'سماعات وايرلس', 'وايرلس', 'صب', 'سماعات رأس', 'سماعة اذن', 'headphone', 'headphones', 'earbuds', 'airpods', 'سوني', 'sony'],
    
    // 6. بلايستيشن وجيمنج وألعاب فيديو
    ['بلايستيشن', 'بلاي ستيشن', 'بليستيشن', 'بلايستيشن 5', 'بي اس 5', 'سوني 5', 'كونسول', 'جهاز العاب', 'دراع', 'دراعات', 'دراع بلايستيشن', 'كنترولر', 'جوي ستيك', 'جيمنج', 'جيمينج', 'العاب', 'ألعاب', 'لعبه', 'لعبة', 'playstation', 'ps5', 'ps4', 'controller', 'gaming', 'games'],
    
    // 7. ساعات ذكية وساعات يد
    ['ساعة', 'ساعات', 'ساعه', 'سمارت ووتش', 'ساعة سمارت', 'ساعة ذكية', 'ساعه ذكيه', 'ساعة يد', 'ساعه يد', 'ساعة كاسيو', 'كاسيو', 'اديفيس', 'ابل ووتش', 'ساعة ابل', 'سوار ذكي', 'باند', 'watch', 'smartwatch', 'casio', 'edifice', 'apple watch'],
    
    // 8. باوربانك وشواحن وبطاريات
    ['باوربانك', 'باور بانك', 'باور بنك', 'باوربنك', 'بنك طاقة', 'بنك الطاقه', 'شاحن', 'شواحن', 'شاحن سريع', 'بطارية', 'بطاريه', 'بطاريات', 'حجارة شحن', 'كابل', 'كابلات', 'وصلة', 'وصلات', 'سلك شاحن', 'تايب سي', 'انكر', 'powerbank', 'charger', 'battery', 'cable', 'anker'],
    
    // 9. كوتشيات وأحذية وجزم
    ['كوتشي', 'كوتشيات', 'شوز', 'جزمة', 'جزمه', 'جزم', 'حذاء', 'أحذية', 'احذية', 'حذاء رياضي', 'حذاء جري', 'سنيكرز', 'سليبر', 'شبشب', 'صندل', 'نايك', 'نايكي', 'اديداس', 'أديداس', 'shoes', 'sneakers', 'nike', 'adidas', 'running'],
    
    // 10. ملابس وهدوم ولبس
    ['هدوم', 'لبس', 'ملابس', 'أزياء', 'ازياء', 'تيشيرت', 'تيشيرتات', 'تي شيرت', 'تيشرت', 'تيشرتات', 'هودي', 'هوديز', 'سويت شيرت', 'سويتشيرت', 'بلوفر', 'بلوفرات', 'جاكيت', 'جواكت', 'چاكيت', 'بنطلون', 'بناطيل', 'قميص', 'قمصان', 'فستان', 'فساتين', 'ترنج', 'ترنجات', 'fashion', 'hoodie', 'sweatshirt', 'clothes'],
    
    // 11. شنط وحقائب وبوك ومحافظ
    ['شنطة', 'شنط', 'شنطه', 'حقيبة', 'حقائب', 'حقيبه', 'حقيبة يد', 'شنطة يد', 'شنطة خروج', 'شنطة ظهر', 'شنطة سفر', 'شنطة لابتوب', 'محفظة', 'محفظه', 'بوك', 'جلد طبيعي', 'كروس', 'باج', 'bag', 'handbag', 'backpack', 'wallet'],
    
    // 12. نظارات ونضارات وشمسية
    ['نظارة', 'نظارات', 'نظاره', 'نضارة', 'نضارات', 'نضاره', 'نظارة شمس', 'نظاره شمس', 'نضارة شمس', 'نضاره شمس', 'نظارة شمسية', 'نضارة شمسية', 'شمسية', 'ريبان', 'ري بان', 'افياتور', 'عدسات', 'sunglasses', 'glasses', 'rayban', 'ray-ban', 'aviator'],
    
    // 13. قلايات هوائية وايرفراير
    ['قلاية', 'قلايات', 'قلايه', 'قلاية هوائية', 'قلايه بدون زيت', 'ايرفراير', 'اير فراير', 'اير فراير فيليبس', 'حلة تحمير', 'فيليبس', 'airfryer', 'fryer', 'philips'],
    
    // 14. أواني طهي وحلل وطاسات
    ['حلل', 'حلة', 'حله', 'طقم حلل', 'طناجر', 'طنجرة', 'طاسات', 'طاسة', 'طاسه', 'مقلاية', 'أواني', 'اواني', 'أواني طهي', 'طقم اواني', 'تيفال زهران', 'زهران', 'cookware', 'pots', 'pans', 'zahran'],
    
    // 15. ماكينات قهوة واسبريسو وبن
    ['ماكينة قهوة', 'ماكينه قهوه', 'صانعة القهوة', 'كوفي ميكر', 'ميكر قهوة', 'ميكر', 'قهوة', 'قهوه', 'اسبريسو', 'إسبريسو', 'نسبريسو', 'كبسولات', 'كبسولات قهوة', 'بن', 'بون', 'نسكافيه', 'coffee', 'espresso', 'nespresso'],
    
    // 16. مكانس وروبوت ونظافة
    ['مكنسة', 'مكانس', 'مكنسه', 'مكنسة روبوت', 'مكنسة ذكية', 'ممسحة ذكية', 'ممسحة', 'مساحه', 'روبوت', 'مسح', 'نظافة', 'نضافه', 'شفاط', 'شاومي', 'فاكيوم', 'vacuum', 'robot', 'mop', 'xiaomi'],
    
    // 17. كراسي مكتبية وأثاث
    ['كرسي', 'كراسي', 'كرسى', 'كرسي مكتب', 'كرسي مريح', 'كرسي طبي', 'كرسي جيمنج', 'كرسي دوار', 'مسند ظهر', 'مسند راس', 'مكتب', 'مكاتب', 'أثاث', 'اثاث', 'عفش', 'chair', 'office chair', 'ergonomic'],
    
    // 18. عطور وبرفانات وبيرفيوم
    ['عطر', 'عطور', 'برفان', 'برفانات', 'بارفان', 'بارفانات', 'بيرفيوم', 'بيرفيومات', 'بارفيوم', 'بارفوم', 'ريحة', 'كولونيا', 'معطر', 'ديور', 'سوفاج', 'توم فورد', 'بلاك اوركيد', 'perfume', 'fragrance', 'dior', 'tom ford', 'sauvage'],
    
    // 19. عناية بالبشرة وغسول وكريمات
    ['غسول', 'غسول وجه', 'غسول للبشرة', 'كريم', 'كريمات', 'ترطيب', 'مرطب', 'لوشن', 'سيروم', 'منظف', 'صابون', 'صابونة', 'سيرافي', 'هيالورونيك', 'مكياج', 'ميك اب', 'skincare', 'cleanser', 'cerave', 'lotion', 'cream'],
    
    // 20. استشوار ومصفف شعر وبيبي ليس
    ['استشوار', 'سشوار', 'سيشوار', 'مصفف شعر', 'مجفف شعر', 'مكواة شعر', 'مكوه شعر', 'بيبي ليس', 'دايسون', 'اير راب', 'فير', 'ليس', 'تسريح', 'شعر', 'dyson', 'airwrap', 'hair dryer', 'styler'],
    
    // 21. جيم ودمبلز وأوزان ولياقة
    ['دمبل', 'دمبلز', 'دامبل', 'دامبلز', 'أوزان', 'اوزان', 'طارات', 'حديد', 'بار', 'باربيل', 'جيم', 'تمارين', 'فتنس', 'لياقة', 'رياضة', 'dumbbells', 'weights', 'gym', 'fitness'],
    
    // 22. يوجا ومات وسجادة تمارين
    ['سجادة يوجا', 'مفرش يوجا', 'مات يوجا', 'فرشة يوجا', 'سجادة رياضية', 'فرشة تمارين', 'يوجا', 'يوغا', 'بساط رياضي', 'yoga', 'yoga mat'],
    
    // 23. كورة وكرة قدم وفيفا
    ['كورة', 'كوره', 'كرة قدم', 'كره قدم', 'كورة قدم', 'كرة', 'كوره رياضيه', 'فيفا', 'كورة اديداس', 'football', 'soccer', 'ball', 'fifa'],
    
    // 24. كتب وروايات وقراءة
    ['كتاب', 'كتب', 'كتاب ورقي', 'رواية', 'روايات', 'كتاب العادات الذرية', 'العادات الذرية', 'جيمس كلير', 'تنمية بشرية', 'تطوير الذات', 'قراءة', 'book', 'books', 'atomic habits', 'reading'],
    
    // 25. ليجو ومكعبات وتركيب
    ['ليجو', 'ليقو', 'مكعبات', 'تركيب', 'مجموعة تركيب', 'سيارة سباق', 'عربية سباق', 'عربية تركيب', 'ألعاب تركيب', 'lego', 'technic', 'blocks'],
    
    // 26. بنك الحظ ومونوبولي وبورد جيمز
    ['مونوبولي', 'بنك الحظ', 'لعبه بنك الحظ', 'لعبة طاولة', 'العاب طاولة', 'بورد جيم', 'بورد جيمز', 'العاب جماعية', 'monopoly', 'board game'],
    
    // 27. سوبرماركت وأغذية وسناكس
    ['سوبرماركت', 'اكل', 'طعام', 'أغذية', 'اغذية', 'سناكس', 'شيبسي', 'شوكولاته', 'شيكولاته', 'حلويات', 'عصائر', 'شاي', 'نسكافيه', 'بقالة', 'بقاله', 'grocery', 'food', 'snacks'],
    
    // 28. مستلزمات سيارات وإكسسوارات
    ['عربية', 'عربيات', 'سيارة', 'سيارات', 'إكسسوارات سيارات', 'شاحن عربية', 'حامل موبايل للعربية', 'فواحة عربية', 'مكنسة عربية', 'car', 'automotive']
  ],

  _synonymMap: null,

  getSynonymMap() {
    if (this._synonymMap) return this._synonymMap;
    const map = {};
    this.synonymGroups.forEach(group => {
      group.forEach(word => {
        const norm = this.normalize(word);
        if (!map[norm]) map[norm] = new Set();
        group.forEach(target => map[norm].add(this.normalize(target)));
      });
    });
    this._synonymMap = map;
    return map;
  },

  normalize(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/[ڤ]/g, 'ف')
      .replace(/[چ]/g, 'ج')
      .replace(/[پ]/g, 'ب')
      .replace(/[ګگک]/g, 'ك')
      .replace(/ة/g, 'ه')
      .replace(/[ىئ]/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/[^\w\s\u0600-\u06FF]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  cleanPrefix(w) {
    if (!w) return '';
    return w.replace(/^(ال|و|بال|كال|فال|لل)/, '');
  },

  wordMatch(prodWord, token) {
    if (!prodWord || !token) return false;
    if (prodWord === token) return true;
    const clean = this.cleanPrefix(prodWord);
    if (clean === token) return true;
    if (token.length >= 4 && (prodWord.startsWith(token) || clean.startsWith(token))) return true;
    return false;
  },

  getTokens(phrase) {
    const norm = this.normalize(phrase);
    const tokens = new Set([norm]);
    const synMap = this.getSynonymMap();

    if (synMap[norm]) {
      synMap[norm].forEach(a => tokens.add(a));
    }

    if (norm.startsWith('ال') && norm.length > 3) {
      const withoutAl = norm.slice(2);
      tokens.add(withoutAl);
      if (synMap[withoutAl]) {
        synMap[withoutAl].forEach(a => tokens.add(a));
      }
    }

    if (norm.endsWith('ات') && norm.length > 4) tokens.add(norm.slice(0, -2));
    if (norm.endsWith('ه') && norm.length > 3) tokens.add(norm.slice(0, -1));

    return Array.from(tokens).filter(t => t.length > 1);
  },

  score(product, query) {
    if (!query || !query.trim()) return 100;
    const normQuery = this.normalize(query);
    const nameNorm = this.normalize(product.name || '');
    const descNorm = this.normalize(product.description || '');
    const catNorm = this.normalize(product.category || '');
    const brandNorm = this.normalize(product.merchantName || '');
    
    const nameWords = nameNorm.split(/\s+/).filter(Boolean);
    const descWords = descNorm.split(/\s+/).filter(Boolean);

    let score = 0;

    // 1. Check full-phrase synonyms (e.g. 'بنك الحظ', 'نضارة شمس', 'مكواة شعر', 'مفرش يوجا')
    const fullTokens = this.getTokens(normQuery);
    for (const token of fullTokens) {
      if (token.includes(' ')) {
        if (nameNorm.includes(token)) score += 180;
        else if (descNorm.includes(token)) score += 80;
      } else {
        if (nameWords.some(pw => this.wordMatch(pw, token))) {
          score += (token === normQuery ? 150 : 120);
        }
      }
    }

    // 2. Individual word matching across name, category, brand, and description
    const queryWords = query.trim().split(/\s+/).filter(Boolean);
    let allWordsMatched = true;

    for (const qWord of queryWords) {
      const normQ = this.normalize(qWord);
      const tokens = this.getTokens(qWord);
      let wordMatched = false;
      let wordScore = 0;

      // Match in product name
      for (const token of tokens) {
        if (nameWords.some(pw => this.wordMatch(pw, token))) {
          wordScore = Math.max(wordScore, token === normQ ? 100 : 75);
          wordMatched = true;
          break;
        }
      }

      // Match in category
      if (!wordMatched) {
        for (const token of tokens) {
          if (catNorm === token) {
            wordScore = Math.max(wordScore, 35);
            wordMatched = true;
            break;
          }
        }
      }

      // Match in merchant / brand
      if (!wordMatched) {
        for (const token of tokens) {
          if (brandNorm.includes(token)) {
            wordScore = Math.max(wordScore, 30);
            wordMatched = true;
            break;
          }
        }
      }

      // Match in description
      if (!wordMatched) {
        for (const token of tokens) {
          if (descWords.some(dw => this.wordMatch(dw, token))) {
            wordScore = Math.max(wordScore, 15);
            wordMatched = true;
            break;
          }
        }
      }

      if (wordMatched) {
        score += wordScore;
      } else {
        allWordsMatched = false;
      }
    }

    // If query was multi-word and no phrase matched AND not all individual words matched, return 0
    if (queryWords.length > 1 && score < 120 && !allWordsMatched) {
      return 0;
    }

    return score;
  },

  match(product, query) {
    return this.score(product, query) > 0;
  }
};

// ===== PRODUCTS DB =====
const ProductsDB = {
  _seeding: false,
  getAll() {
    let prods = Storage.get('souq_products');
    if ((!prods || !Array.isArray(prods) || prods.length === 0) && !this._seeding) {
      this._seeding = true;
      try { seedData(true); } catch(e) {}
      this._seeding = false;
      prods = Storage.get('souq_products');
    }
    return Array.isArray(prods) ? prods : [];
  },
  save(products) { Storage.set('souq_products', products); },

  add(product) {
    const products = this.getAll();
    product.id = product.id || ('prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8));
    product.createdAt = product.createdAt || new Date().toISOString();
    product.rating = product.rating || (Math.random() * 1.5 + 3.5).toFixed(1);
    product.reviewCount = product.reviewCount || Math.floor(Math.random() * 350 + 25);
    product.sold = product.sold || Math.floor(Math.random() * 800 + 40);
    products.push(product);
    this.save(products);
    return product;
  },

  getByMerchant(merchantId) {
    return this.getAll().filter(p => p.merchantId === merchantId);
  },

  getById(id) {
    return this.getAll().find(p => p.id === id);
  },

  update(id, data) {
    const products = this.getAll();
    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...data };
      this.save(products);
      return products[idx];
    }
    return null;
  },

  delete(id) {
    const products = this.getAll().filter(p => p.id !== id);
    this.save(products);
  },

  search(query, filters = {}) {
    let products = this.getAll();
    
    if (query) {
      products = products
        .map(p => ({ product: p, score: SearchEngine.score(p, query) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product);
    }
    
    if (filters.category && filters.category !== 'all') {
      products = products.filter(p => p.category === filters.category);
    }
    
    if (filters.minPrice !== undefined) {
      products = products.filter(p => p.price >= filters.minPrice);
    }
    
    if (filters.maxPrice !== undefined) {
      products = products.filter(p => p.price <= filters.maxPrice);
    }

    if (filters.sort && filters.sort !== 'relevance' && filters.sort !== 'featured') {
      switch (filters.sort) {
        case 'price-asc': products.sort((a,b) => a.price - b.price); break;
        case 'price-desc': products.sort((a,b) => b.price - a.price); break;
        case 'newest': products.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
        case 'rating': products.sort((a,b) => b.rating - a.rating); break;
      }
    }

    return products;
  }
};

// ===== CART DB =====
const CartDB = {
  getCart() { 
    const userId = Auth.currentUser?.id || 'guest';
    return Storage.get(`souq_cart_${userId}`) || [];
  },

  saveCart(cart) {
    const userId = Auth.currentUser?.id || 'guest';
    Storage.set(`souq_cart_${userId}`, cart);
  },

  addItem(productId, quantity = 1) {
    const cart = this.getCart();
    const product = ProductsDB.getById(productId);
    if (!product) return false;

    const existing = cart.find(item => item.productId === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({ productId, quantity, addedAt: new Date().toISOString() });
    }
    this.saveCart(cart);
    updateCartBadge();
    return true;
  },

  removeItem(productId) {
    const cart = this.getCart().filter(item => item.productId !== productId);
    this.saveCart(cart);
    updateCartBadge();
  },

  updateQuantity(productId, quantity) {
    const cart = this.getCart();
    const item = cart.find(i => i.productId === productId);
    if (item) {
      if (quantity <= 0) return this.removeItem(productId);
      item.quantity = quantity;
      this.saveCart(cart);
    }
    updateCartBadge();
  },

  getTotal() {
    const cart = this.getCart();
    return cart.reduce((total, item) => {
      const product = ProductsDB.getById(item.productId);
      return total + (product?.price || 0) * item.quantity;
    }, 0);
  },

  getCount() {
    return this.getCart().reduce((total, item) => total + item.quantity, 0);
  },

  clear() {
    const userId = Auth.currentUser?.id || 'guest';
    Storage.remove(`souq_cart_${userId}`);
    updateCartBadge();
  }
};

// ===== ORDERS DB =====
const OrdersDB = {
  getAll() { return Storage.get('souq_orders') || []; },
  save(orders) { Storage.set('souq_orders', orders); },

  add(order) {
    const orders = this.getAll();
    order.id = 'ORD-' + Date.now();
    order.createdAt = new Date().toISOString();
    order.status = 'pending';
    orders.push(order);
    this.save(orders);
    return order;
  },

  getByUser(userId) {
    return this.getAll().filter(o => o.userId === userId);
  }
};

// ===== WISHLIST DB =====
const WishlistDB = {
  getAll() {
    const userId = Auth.currentUser?.id || 'guest';
    return Storage.get(`souq_wishlist_${userId}`) || [];
  },

  save(list) {
    const userId = Auth.currentUser?.id || 'guest';
    Storage.set(`souq_wishlist_${userId}`, list);
  },

  toggle(productId) {
    const list = this.getAll();
    const idx = list.indexOf(productId);
    if (idx !== -1) {
      list.splice(idx, 1);
    } else {
      list.push(productId);
    }
    this.save(list);
    return idx === -1; // true if added
  },

  has(productId) {
    return this.getAll().includes(productId);
  }
};

// ===== SEED DATA =====
const SEED_VERSION = 'v6_wasla_catalog';

function seedData(force = false) {
  const currentVersion = Storage.get('souq_seed_version');
  const raw = Storage.get('souq_products');
  
  // If we already have the full catalog seeded, skip
  if (!force && currentVersion === SEED_VERSION && Array.isArray(raw) && raw.length >= 25) return;

  // Clear and re-populate fresh products
  Storage.remove('souq_products');
  Storage.set('souq_seed_version', SEED_VERSION);

  // Seed a default merchant
  let merchantUser = UsersDB.findByEmail('merchant@wasla.com') || UsersDB.findByEmail('merchant@souqplus.com');
  if (!merchantUser) {
    merchantUser = UsersDB.add({
      name: 'متجر وصلة الرسمي',
      email: 'merchant@wasla.com',
      password: '123456',
      role: 'merchant',
      storeName: 'متجر وصلة إكسبريس'
    });
  } else {
    merchantUser.name = 'متجر وصلة الرسمي';
    merchantUser.storeName = 'متجر وصلة إكسبريس';
  }

  // Seed a default buyer demo
  if (!UsersDB.findByEmail('buyer@wasla.com') && !UsersDB.findByEmail('buyer@souqplus.com')) {
    UsersDB.add({ name: 'أحمد مشتري', email: 'buyer@wasla.com', password: '123456', role: 'buyer' });
  }

  const sampleProducts = [
    // --- إلكترونيات (Electronics) ---
    {
      id: 'prod_iphone15',
      name: 'هاتف Apple iPhone 15 Pro Max سعة 256 جيجابايت تيتانيوم أزرق',
      description: 'شاشة Super Retina XDR مقاس 6.7 إنش مع تقنية ProMotion، معالج A17 Pro الجبار، وكاميرا رئيسية بدقة 48 ميجابكسل مع تقريب بصري 5x.',
      price: 61999,
      oldPrice: 68500,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 25,
      rating: '4.9',
      reviewCount: 312,
      sold: 840
    },
    {
      id: 'prod_s24ultra',
      name: 'هاتف Samsung Galaxy S24 Ultra يدعم الذكاء الاصطناعي 512 جيجابايت',
      description: 'معالج Snapdragon 8 Gen 3 وقلم S Pen مدمج، شاشة ديناميكية AMOLED 2X فائقة السطوع وكاميرا بدقة 200 ميجابكسل تدعم الذكاء الاصطناعي Galaxy AI.',
      price: 54999,
      oldPrice: 59999,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 18,
      rating: '4.8',
      reviewCount: 245,
      sold: 620
    },
    {
      id: 'prod_macbook_m3',
      name: 'لاب توب Apple MacBook Air 15 بوصة معالج M3 ذاكرة 16GB RAM',
      description: 'تصميم فائق النحافة وخفة الوزن مع شاشة Liquid Retina المذهلة، أداء فائق السرعة وبطارية تدوم حتى 18 ساعة عمل متواصل.',
      price: 67500,
      oldPrice: 74000,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 12,
      rating: '4.9',
      reviewCount: 180,
      sold: 390
    },
    {
      id: 'prod_sony_xm5',
      name: 'سماعات رأس لاسلكية Sony WH-1000XM5 عازلة للضوضاء',
      description: 'سماعات احترافية بتقنية إلغاء الضوضاء الرائدة عالمياً بمحرك صوتي عالي الدقة وبطارية تدوم 30 ساعة مع شحن سريع.',
      price: 15499,
      oldPrice: 18200,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 45,
      rating: '4.9',
      reviewCount: 420,
      sold: 1100
    },
    {
      id: 'prod_ps5_slim',
      name: 'جهاز سوني PlayStation 5 Slim إصدار الأقراص مع ذراع DualSense إضافي',
      description: 'ألعاب الجيل الجديد بدقة 4K ومعدل تحديث يصل إلى 120 إطاراً في الثانية، مع تقنية تتبع الأشعة وتخزين SSD فائق السرعة 1TB.',
      price: 29800,
      oldPrice: 33500,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 20,
      rating: '4.9',
      reviewCount: 512,
      sold: 1450
    },
    {
      id: 'prod_airpods_pro',
      name: 'سماعات Apple AirPods Pro (الجيل الثاني) مع علبة شحن MagSafe Type-C',
      description: 'إلغاء نشط للضوضاء بمقدار يصل إلى الضعف، ميزة الصوت المكاني المخصص، وعمر بطارية يصل إلى 30 ساعة مع العلبة.',
      price: 10899,
      oldPrice: 12500,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 65,
      rating: '4.8',
      reviewCount: 380,
      sold: 970
    },
    {
      id: 'prod_samsung_tv65',
      name: 'شاشة تلفزيون ذكي Samsung QLED 65 بوصة بدقة 4K UHD مع ريموت طاقة شمسية',
      description: 'تقنية Quantum HDR ومعالج Quantum 4K الذكي، يدعم تطبيقات Netflix و Shahid و YouTube مع نظام صوتي محيطي.',
      price: 26999,
      oldPrice: 32000,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f4834d?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 14,
      rating: '4.7',
      reviewCount: 160,
      sold: 340
    },
    {
      id: 'prod_apple_watch9',
      name: 'ساعة ذكية Apple Watch Series 9 إطار ألومنيوم مقاس 45 مم',
      description: 'شريحة S9 المتقدمة مع ميزة حركة الضغط مرتين وشاشة فائقة السطوع، ومستشعرات متطورة للصحة ومخطط ضربات القلب.',
      price: 18999,
      oldPrice: 21999,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 35,
      rating: '4.8',
      reviewCount: 220,
      sold: 580
    },
    {
      id: 'prod_anker_powerbank',
      name: 'باور بانك Anker PowerCore سعة 20,000 مللي أمبير بقوة 30 واط شحن فائق السرعة',
      description: 'شحن الهواتف والأجهزة اللوحية بكفاءة عالية مع منافذ USB-C و USB-A وتقنية PowerIQ الذكية للحماية من الحرارة الزائدة.',
      price: 1650,
      oldPrice: 2100,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1609592424364-7756f7ef0502?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 90,
      rating: '4.7',
      reviewCount: 410,
      sold: 1600
    },

    // --- أزياء وموضة (Fashion) ---
    {
      id: 'prod_nike_airmax',
      name: 'حذاء رياضي Nike Air Max 270 للرجال بتصميم عصري وأقصى راحة',
      description: 'نعل هوائي كبير يوفر توسيداً فائقاً ومرونة استثنائية، خفيف الوزن ومثالي للأنشطة الرياضية والارتداء اليومي الأنيق.',
      price: 3899,
      oldPrice: 4799,
      category: 'fashion',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 50,
      rating: '4.8',
      reviewCount: 290,
      sold: 810
    },
    {
      id: 'prod_adidas_ultraboost',
      name: 'حذاء جري Adidas Ultraboost Light للرجال أسود في أبيض',
      description: 'تقنية Boost الأخف وزناً على الإطلاق لاسترجاع الطاقة مع كل خطوة، مع جزء علوي من نسيج Primeknit داعم للقدم.',
      price: 4350,
      oldPrice: 5200,
      category: 'fashion',
      image: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 40,
      rating: '4.9',
      reviewCount: 195,
      sold: 520
    },
    {
      id: 'prod_casio_edifice',
      name: 'ساعة يد رجالية Casio Edifice بمينا أسود وسوار ستانلس ستيل فضي',
      description: 'ساعة كوارتز يابانية مقاومة للماء حتى عمق 100 متر مع كرونوغراف لقياس الوقت وتاريخ مدمج وتصميم كلاسيكي فخم.',
      price: 3600,
      oldPrice: 4500,
      category: 'fashion',
      image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 30,
      rating: '4.7',
      reviewCount: 140,
      sold: 430
    },
    {
      id: 'prod_rayban_sunglasses',
      name: 'نظارة شمسية Ray-Ban Aviator الكلاسيكية مستقطبة بإطار ذهبي',
      description: 'عدسات زجاجية تحمي بنسبة 100% من الأشعة فوق البنفسجية UV400 مع إطار معدني عالي المتانة ومقاوم للصدأ.',
      price: 4200,
      oldPrice: 5300,
      category: 'fashion',
      image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 25,
      rating: '4.8',
      reviewCount: 175,
      sold: 380
    },
    {
      id: 'prod_leather_handbag',
      name: 'حقيبة يد نسائية فاخرة من الجلد الطبيعي الأصلي بلون بني دافئ',
      description: 'مساحة تخزين متعددة الجيوب بسحاب إغلاق ناعم وحزام كتف قابل للتعديل والإزالة، صناعة يدوية عالية الجودة.',
      price: 2150,
      oldPrice: 2800,
      category: 'fashion',
      image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 35,
      rating: '4.6',
      reviewCount: 110,
      sold: 290
    },
    {
      id: 'prod_hoodie_black',
      name: 'سويت شيرت هودي قطني ثقيل للرجال والنساء بلون أسود أنيق',
      description: 'قطن مصري 100% مبطن بصوف دافئ وناعم، تصميم مريح وفضفاض مع جيب أمامي متصل وقبعة برباط شد متين.',
      price: 699,
      oldPrice: 950,
      category: 'fashion',
      image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 120,
      rating: '4.7',
      reviewCount: 340,
      sold: 950
    },

    // --- المنزل والمطبخ (Home) ---
    {
      id: 'prod_philips_airfryer',
      name: 'قلاية هوائية فيليبس Philips Airfryer XXL سعة 7.2 لتر مع شاشة لمس',
      description: 'تقنية Rapid Air لتحضير طعام مقرمش وصحي بدهون أقل بنسبة تصل إلى 90%، مع 16 برنامج طهي محدد مسبقاً وتطبيق وصفات ذكي.',
      price: 7899,
      oldPrice: 9500,
      category: 'home',
      image: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 40,
      rating: '4.9',
      reviewCount: 480,
      sold: 1350
    },
    {
      id: 'prod_nespresso_coffee',
      name: 'ماكينة تحضير قهوة إسبريسو Nespresso Essenza Mini المدمجة',
      description: 'ضغط مضخة احترافي 19 بار لتحضير كوب إسبريسو أو لونغو غني بالكريمة بلمسة زر واحدة خلال 25 ثانية فقط.',
      price: 4950,
      oldPrice: 6200,
      category: 'home',
      image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 30,
      rating: '4.8',
      reviewCount: 260,
      sold: 720
    },
    {
      id: 'prod_tefal_cookware',
      name: 'طقم أواني طهي تيفال زهران غير لاصقة 10 قطع من التيتانيوم',
      description: 'مؤشر Thermo-Signal الحراري لدرجة الحرارة المثالية، طلاء تيتانيوم مانع للالتصاق يدوم طويلاً وخالٍ من حمض PFOA.',
      price: 4400,
      oldPrice: 5600,
      category: 'home',
      image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 45,
      rating: '4.8',
      reviewCount: 310,
      sold: 640
    },
    {
      id: 'prod_ergonomic_chair',
      name: 'كرسي مكتب طبي Ergonomic Pro مع مسند رأس ودعم فقرات قطنية قابل للتعديل',
      description: 'شبكة تهوية مريحة تمنع التعرق، مساند ذراع ثلاثية الأبعاد، قاعدة قوية من الفولاذ مع عجلات صامتة وسلاسة دوران 360 درجة.',
      price: 3850,
      oldPrice: 4900,
      category: 'home',
      image: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 25,
      rating: '4.7',
      reviewCount: 185,
      sold: 460
    },
    {
      id: 'prod_robot_vacuum',
      name: 'مكنسة روبوت ذكية مع مسح أرضيات Xiaomi Robot Vacuum Mop بملاحة ليزر',
      description: 'قوة شفط فائقة 4000 باسكال، نظام مسح رطب ذكي، خرائط متعددة الطوابق والتحكم الكامل عبر تطبيق الهاتف الذكي.',
      price: 11200,
      oldPrice: 13900,
      category: 'home',
      image: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 15,
      rating: '4.6',
      reviewCount: 95,
      sold: 210
    },

    // --- جمال وعطور (Beauty) ---
    {
      id: 'prod_dior_sauvage',
      name: 'عطر Dior Sauvage للرجال أو دو بارفان حجم 100 مل أصلي 100%',
      description: 'مزيج أيقوني من البرغموت المنعش مع نفحات الفلفل الحار وخشب الصندل والعنبر، عطر جذاب يدوم طويلاً طوال اليوم.',
      price: 6400,
      oldPrice: 7500,
      category: 'beauty',
      image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 45,
      rating: '4.9',
      reviewCount: 520,
      sold: 1400
    },
    {
      id: 'prod_tomford_orchid',
      name: 'عطر Tom Ford Black Orchid الفاخر للجنسين 100 مل أصلي',
      description: 'عطر كلاسيكي فاخر يجمع بين أزهار الأوركيد السوداء الغامضة والباتشولي مع لمسات البخور والشوكولاتة المترفة.',
      price: 7200,
      oldPrice: 8600,
      category: 'beauty',
      image: 'https://images.unsplash.com/photo-1541643600914-78b084683702?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 30,
      rating: '4.8',
      reviewCount: 310,
      sold: 690
    },
    {
      id: 'prod_cerave_cleanser',
      name: 'غسول رغوي للبشرة CeraVe Foaming Cleanser بحمض الهيالورونيك 473 مل',
      description: 'ينظف البشرة بعمق ويزيل الزيوت الزائدة والمكياج دون تجريد حاجز الحماية الطبيعي للبشرة، مع 3 سيراميدات أساسية.',
      price: 640,
      oldPrice: 850,
      category: 'beauty',
      image: 'https://images.unsplash.com/photo-1608248597359-59752390a88c?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 140,
      rating: '4.8',
      reviewCount: 680,
      sold: 2100
    },
    {
      id: 'prod_dyson_airwrap',
      name: 'مصفف ومجفف شعر Dyson Airwrap Multi-Styler متعدد الاستخدامات',
      description: 'تصفيف وتمويج وتجفيف الشعر باستخدام تدفق الهواء بتأثير كواندا ودون تلف حراري مفرط، لنتائج صالونات احترافية في المنزل.',
      price: 28999,
      oldPrice: 33000,
      category: 'beauty',
      image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 12,
      rating: '4.9',
      reviewCount: 160,
      sold: 310
    },

    // --- رياضة ولياقة (Sports) ---
    {
      id: 'prod_dumbbells_set',
      name: 'طقم دمبلز وأوزان تدريب منزلي 20 كجم مع بار توصيل لتحويلها لباربيل',
      description: 'أقراص وزن متينة مطلية بالمطاط لحماية الأرضيات، مع قفل أمان سريع ومقابض مريحة مانعة للانزلاق لبناء العضلات.',
      price: 1850,
      oldPrice: 2400,
      category: 'sports',
      image: 'https://images.unsplash.com/photo-1586401100295-7a8096fd231a?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 50,
      rating: '4.7',
      reviewCount: 230,
      sold: 720
    },
    {
      id: 'prod_yoga_mat',
      name: 'سجادة يوجا وتمارين رياضية طبية سمك 10 مم مضادة للانزلاق مع حزام حمل',
      description: 'مصنوعة من مادة NBR عالية الكثافة الصديقة للبيئة، توفر راحة تامة للمفاصل والركب أثناء التمارين وسهلة التنظيف والتخزين.',
      price: 450,
      oldPrice: 650,
      category: 'sports',
      image: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 100,
      rating: '4.8',
      reviewCount: 340,
      sold: 1250
    },
    {
      id: 'prod_adidas_football',
      name: 'كرة قدم Adidas التنافسية الأصلية مقاس 5 معتمدة من FIFA',
      description: 'هيكل حراري ملحوم بدون درزات لتمريرات دقيقة ومسار طيران مستقر، تحافظ على ضغط الهواء وثبات الأداء في كل الأجواء.',
      price: 1100,
      oldPrice: 1450,
      category: 'sports',
      image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 70,
      rating: '4.8',
      reviewCount: 180,
      sold: 610
    },

    // --- كتب وألعاب (Books & Toys) ---
    {
      id: 'prod_atomic_habits',
      name: 'كتاب "العادات الذرية" للكاتب جيمس كلير - النسخة العربية الأصلية',
      description: 'الكتاب الأكثر مبيعاً عالمياً لبناء عادات جيدة والتخلص من العادات السيئة خطوة بخطوة بطرق عملية ومثبتة علمياً.',
      price: 280,
      oldPrice: 380,
      category: 'books',
      image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 150,
      rating: '4.9',
      reviewCount: 420,
      sold: 1800
    },
    {
      id: 'prod_lego_technic',
      name: 'مجموعة تركيب سيارة سباق رياضية Lego Technic للأطفال والكبار 830 قطعة',
      description: 'نموذج هندسي تفاعلي بمحرك V6 مع مكابس متحركة ونظام تعليق وتوجيه واقعي، تجربة بناء ممتعة ومحفزة للإبداع.',
      price: 3200,
      oldPrice: 3999,
      category: 'toys',
      image: 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 35,
      rating: '4.9',
      reviewCount: 190,
      sold: 430
    },
    {
      id: 'prod_monopoly_board',
      name: 'لعبة الطاولة اللوحية الكلاسيكية Monopoly الأصلية باللغة العربية',
      description: 'لعبة الصفقات العقارية الأشهر في العالم لجميع أفراد العائلة، شراء وبيع الأراضي والمنازل والفنادق لتصبح المليونير الرابح.',
      price: 650,
      oldPrice: 850,
      category: 'toys',
      image: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=600&h=600&fit=crop',
      merchantId: merchantUser.id,
      merchantName: 'متجر وصلة إكسبريس',
      stock: 80,
      rating: '4.7',
      reviewCount: 260,
      sold: 950
    }
  ];

  sampleProducts.forEach(p => ProductsDB.add(p));
}

// ===== UI HELPERS =====
function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '📢'}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createToastContainer() {
  const div = document.createElement('div');
  div.id = 'toast-container';
  div.className = 'toast-container';
  document.body.appendChild(div);
  return div;
}

function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-badge');
  const count = CartDB.getCount();
  badges.forEach(b => {
    b.textContent = count;
    b.style.display = count > 0 ? 'flex' : 'none';
  });
  const mbBadge = document.getElementById('mobile-cart-badge');
  if (mbBadge) {
    mbBadge.textContent = count;
    mbBadge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function formatPrice(price) {
  return new Intl.NumberFormat('ar-EG').format(price);
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let stars = '';
  for (let i = 0; i < 5; i++) {
    if (i < full) stars += '★';
    else if (i === full && half) stars += '½';
    else stars += '☆';
  }
  return stars;
}

function renderProductCard(product, showActions = true) {
  const isBuyer = Auth.isLoggedIn() && Auth.isBuyer();
  const canBuy = isBuyer || !Auth.isLoggedIn();
  const isWishlisted = WishlistDB.has(product.id);
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  
  return `
    <div class="product-card fade-in" data-id="${product.id}" onclick="viewProduct('${product.id}')">
      <div class="product-card-image">
        <img src="${product.image || 'https://via.placeholder.com/400x400/1e1e38/f5a623?text=منتج'}" 
             alt="${product.name}" 
             loading="lazy"
             decoding="async"
             onerror="this.src='https://via.placeholder.com/400x400/1e1e38/f5a623?text=منتج'">
        ${discount > 0 ? `<span class="product-card-badge">-${discount}%</span>` : ''}
        <div class="product-card-actions">
          ${showActions ? `
          <button class="product-action-btn" onclick="toggleWishlist(event, '${product.id}')" title="المفضلة" id="wish-${product.id}">
            ${isWishlisted ? '❤️' : '🤍'}
          </button>
          <a class="product-action-btn" href="product.html?id=${product.id}" title="عرض التفاصيل" onclick="event.stopPropagation()">👁️</a>
          ` : ''}
        </div>
      </div>
      <div class="product-card-body">
        <div class="product-card-seller">🏪 ${product.merchantName || 'تاجر'}</div>
        <div class="product-card-name">${product.name}</div>
        <div class="product-card-rating">
          <span class="stars">${renderStars(parseFloat(product.rating || 4))}</span>
          <span class="rating-count">(${product.reviewCount || 0})</span>
        </div>
        <div class="product-card-price">
          <span class="price-currency">ج.م</span>
          <span class="price-current">${formatPrice(product.price)}</span>
          ${product.oldPrice ? `<span class="price-old">${formatPrice(product.oldPrice)}</span>` : ''}
        </div>
        <div class="product-card-footer">
          ${canBuy || !Auth.isLoggedIn() ? `
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="addToCart(event, '${product.id}')">
            🛒 أضف للسلة
          </button>
          ` : ''}
          <a href="product.html?id=${product.id}" class="btn btn-ghost btn-sm btn-icon" onclick="event.stopPropagation()" title="التفاصيل">👁️</a>
        </div>
      </div>
    </div>
  `;
}

function viewProduct(id) {
  window.location.href = `product.html?id=${id}`;
}

function addToCart(event, productId) {
  event && event.stopPropagation && event.stopPropagation();
  if (Auth.isMerchant()) {
    showToast('التجار لا يمكنهم الشراء. استخدم حساب مشتري.', 'error');
    return;
  }
  CartDB.addItem(productId);
  showToast('تمت الإضافة للسلة! 🛒', 'success');
}

function toggleWishlist(event, productId) {
  event.stopPropagation();
  if (!Auth.isLoggedIn()) {
    showToast('سجّل دخولك لإضافة للمفضلة', 'info');
    return;
  }
  const added = WishlistDB.toggle(productId);
  const btn = document.getElementById(`wish-${productId}`);
  if (btn) btn.textContent = added ? '❤️' : '🤍';
  showToast(added ? 'تمت الإضافة للمفضلة ❤️' : 'تمت الإزالة من المفضلة', 'info');
}

// ===== NAVBAR RENDERING =====
function renderNavbar(activePage = '') {
  const isLoggedIn = Auth.isLoggedIn();
  const user = Auth.currentUser;
  const cartCount = CartDB.getCount();
  const showCart = !Auth.isMerchant();

  return `
  <nav class="navbar">
    <div class="navbar-inner">
      <a href="index.html" class="navbar-logo" title="WASLA - وصلة">
        <img src="assets/logo.png" alt="WASLA" class="navbar-logo-img">
        <div class="navbar-brand-text">
          <span class="navbar-brand-name">WASLA</span>
          <span class="navbar-brand-sub">وصلة للتسوق الذكي</span>
        </div>
      </a>
      
      <!-- Desktop Search Bar -->
      <div class="navbar-search">
        <input type="text" placeholder="ابحث بالعامية أو الفصحى (موبايل، كوتشي، نضارة، برفان)..." 
               id="global-search"
               onkeydown="if(event.key==='Enter') globalSearch(this.value)"
               autocomplete="off">
        <button class="navbar-search-btn" onclick="globalSearch(document.getElementById('global-search').value)">🔍</button>
      </div>
      
      <div class="navbar-actions">
        <!-- Theme Toggle (Dark / Light) -->
        <button class="theme-toggle-btn" id="theme-toggle" onclick="Theme.toggle()" title="${Theme.current === 'dark' ? 'التبديل إلى الوضع الفاتح (النهار)' : 'التبديل إلى الوضع الداكن (الليل)'}">
          <span class="theme-icon">${Theme.current === 'dark' ? '☀️' : '🌙'}</span>
          <span class="theme-label nav-label-desktop">${Theme.current === 'dark' ? 'فاتح' : 'داكن'}</span>
        </button>

        <!-- Desktop only Store link (Mobile accesses via bottom nav) -->
        <a href="shop.html" class="nav-icon-btn nav-desktop-only" id="nav-shop-link">
          <span>🛍️</span><span style="font-size:13px;font-weight:700">المتجر</span>
        </a>
        
        ${showCart ? `
        <a href="cart.html" class="nav-icon-btn" title="السلة">
          <span>🛒</span>
          <span class="nav-label-desktop" style="font-size:13px;font-weight:700">السلة</span>
          <span class="nav-badge cart-badge" style="display:${cartCount > 0 ? 'flex' : 'none'}">${cartCount}</span>
        </a>
        ` : ''}
        
        ${isLoggedIn ? `
        <div class="nav-user-menu">
          <button class="nav-user-btn" id="user-menu-btn" title="حسابي">
            <div class="nav-user-avatar">${user.name?.charAt(0) || 'U'}</div>
            <span class="nav-label-desktop">${user.name?.split(' ')[0] || 'المستخدم'}</span>
            <span class="nav-label-desktop" style="font-size:11px;opacity:0.6">▾</span>
          </button>
          <div class="nav-dropdown" id="user-dropdown">
            ${Auth.isMerchant() ? `
            <a href="merchant.html">🏪 لوحة التاجر</a>
            <a href="index.html">🏠 الرئيسية</a>
            ` : `
            <a href="shop.html">🛒 تسوق الآن</a>
            <a href="cart.html">🛍️ سلة التسوق</a>
            <a href="index.html">🏠 الرئيسية</a>
            `}
            <button onclick="Auth.logout()">🚪 تسجيل الخروج</button>
          </div>
        </div>
        ` : `
        <a href="auth.html" class="nav-login-pill" title="تسجيل الدخول">
          <span>👤</span><span class="nav-label-desktop">دخول</span>
        </a>
        <a href="auth.html#register" class="btn btn-primary btn-sm nav-desktop-only">إنشاء حساب</a>
        `}
      </div>
    </div>

    <!-- Mobile Search Bar (< 768px) - Clean App Style -->
    <div class="navbar-mobile-search">
      <div class="mobile-search-inner">
        <span class="mobile-search-icon">🔍</span>
        <input type="text" placeholder="ابحث عن منتج (موبايل، كوتشي، نضارة)..."
               id="mobile-global-search"
               onkeydown="if(event.key==='Enter') globalSearch(this.value)"
               autocomplete="off">
        <button class="mobile-search-go" onclick="globalSearch(document.getElementById('mobile-global-search').value)">بحث</button>
      </div>
    </div>
  </nav>`;
}

// ===== MOBILE BOTTOM APP NAVIGATION =====
function renderMobileBottomNav() {
  if (document.getElementById('mobile-bottom-nav')) return;
  const path = window.location.pathname;
  const isHome = path.endsWith('index.html') || path.endsWith('/') || path.endsWith('Project%20capstone') || path.endsWith('Project capstone');
  const isShop = path.endsWith('shop.html');
  const isCart = path.endsWith('cart.html');
  const isAccount = path.endsWith('auth.html') || path.endsWith('merchant.html');
  const cartCount = CartDB.getCount();
  const isLoggedIn = Auth.isLoggedIn();
  const isMerchant = Auth.isMerchant();
  const accountUrl = isLoggedIn ? (isMerchant ? 'merchant.html' : 'javascript:openUserAccountSheet()') : 'auth.html';
  const accountLabel = isLoggedIn ? (isMerchant ? 'التاجر' : (Auth.currentUser?.name?.split(' ')[0] || 'حسابي')) : 'دخول';

  const div = document.createElement('div');
  div.id = 'mobile-bottom-nav';
  div.className = 'mobile-bottom-nav';
  div.innerHTML = `
    <a href="index.html" class="mb-nav-item ${isHome ? 'active' : ''}">
      <span class="mb-icon">🏠</span>
      <span>الرئيسية</span>
    </a>
    <a href="shop.html" class="mb-nav-item ${isShop ? 'active' : ''}">
      <span class="mb-icon">🛍️</span>
      <span>المتجر</span>
    </a>
    <a href="cart.html" class="mb-nav-item ${isCart ? 'active' : ''}">
      <span class="mb-icon">🛒</span>
      <span>السلة</span>
      <span class="mb-badge" id="mobile-cart-badge" style="display:${cartCount > 0 ? 'flex' : 'none'}">${cartCount}</span>
    </a>
    <a href="${accountUrl}" class="mb-nav-item ${isAccount ? 'active' : ''}">
      <span class="mb-icon">👤</span>
      <span>${accountLabel}</span>
    </a>
  `;
  document.body.appendChild(div);
}

function openUserAccountSheet() {
  const existing = document.getElementById('user-account-sheet');
  if (existing) existing.remove();

  const user = Auth.currentUser;
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }

  const div = document.createElement('div');
  div.id = 'user-account-sheet';
  div.className = 'modal-overlay show';
  div.style.zIndex = '999999';
  div.innerHTML = `
    <div class="modal" style="max-width:360px;text-align:center;padding:26px 20px;">
      <div style="width:62px;height:62px;border-radius:50%;background:var(--brand-gradient);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:24px;color:#0b1329;font-weight:900;">
        ${user.name?.charAt(0) || '👤'}
      </div>
      <h3 style="font-size:18px;margin-bottom:4px;color:#fff">${user.name || 'حسابي'}</h3>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:2px">${user.email || ''}</p>
      ${user.phone ? `<p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">📱 ${user.phone}</p>` : '<div style="margin-bottom:16px"></div>'}
      
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-input);padding:8px 12px;border-radius:var(--radius-md);border:1px solid var(--border)">
          <span style="font-size:12px;font-weight:700">المظهر (داكن / فاتح)</span>
          <button class="theme-toggle-btn" onclick="Theme.toggle()" style="padding:4px 10px;font-size:11px">
            <span class="theme-icon">${Theme.current === 'dark' ? '☀️' : '🌙'}</span>
            <span class="theme-label">${Theme.current === 'dark' ? 'فاتح' : 'داكن'}</span>
          </button>
        </div>
        <a href="shop.html" class="btn btn-primary btn-sm" onclick="closeUserAccountSheet()">🛍️ تصفح المنتجات</a>
        <a href="cart.html" class="btn btn-secondary btn-sm" onclick="closeUserAccountSheet()">🛒 سلة المشتريات</a>
        <button class="btn btn-danger btn-sm" onclick="Auth.logout()" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;margin-top:4px;">
          🚪 تسجيل الخروج
        </button>
        <button class="btn btn-ghost btn-sm" onclick="closeUserAccountSheet()" style="font-size:12px;margin-top:2px">إغلاق ✕</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  div.addEventListener('click', (e) => {
    if (e.target === div) closeUserAccountSheet();
  });
}

function closeUserAccountSheet() {
  const el = document.getElementById('user-account-sheet');
  if (el) el.remove();
}

function globalSearch(query) {
  const q = (query || '').trim();
  if (q) {
    window.location.href = 'shop.html?search=' + encodeURIComponent(q);
  } else {
    window.location.href = 'shop.html';
  }
}

// ===== NAVBAR TOGGLE =====
function initNavDropdown() {
  const btn = document.getElementById('user-menu-btn');
  const dropdown = document.getElementById('user-dropdown');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    dropdown?.classList.remove('show');
  });
}

// ===== SCROLL TO TOP =====
function initScrollTop() {
  const btn = document.getElementById('scroll-top');
  if (!btn) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        btn.classList.toggle('show', window.scrollY > 300);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ===== IMMEDIATE BOOTSTRAP =====
try {
  Theme.init();
  Auth.init();
  seedData();
} catch (e) {
  console.warn('Initial seed error:', e);
}

// ===== PREVENT SCREEN ZOOM (MOBILE & DESKTOP) =====
function initAntiZoom() {
  // Prevent iOS Safari proprietary pinch gesture zoom (only on iOS)
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
  }

  // Prevent Ctrl + Mouse Wheel zoom on desktop
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initAntiZoom();
  Theme.init();
  Auth.init();
  seedData();
  
  const navEl = document.getElementById('navbar-placeholder');
  if (navEl) {
    navEl.innerHTML = renderNavbar();
    initNavDropdown();
    updateCartBadge();
  }

  renderMobileBottomNav();
  initScrollTop();
});

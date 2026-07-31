// Auto-extracted db.js
export const LOCAL_FOOD_DB = [
  /* ── CEREALES Y HARINAS ── */
  {
    name: "Arroz blanco cocido", aliases: ["arroz", "arroz blanco", "arroz cocido"],
    category: "Cereal", calories_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28.2, fat_per_100g: 0.3, fiber_per_100g: 0.4, sugar_per_100g: 0.1,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 158, cucharada: 13 }
  },

  {
    name: "Arroz integral cocido", aliases: ["arroz integral"],
    category: "Cereal", calories_per_100g: 123, protein_per_100g: 2.7, carbs_per_100g: 25.6, fat_per_100g: 1.0, fiber_per_100g: 1.8, sugar_per_100g: 0.2,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 195 }
  },

  {
    name: "Avena en hojuelas", aliases: ["avena", "hojuelas de avena", "oats"],
    category: "Cereal", calories_per_100g: 389, protein_per_100g: 16.9, carbs_per_100g: 66.3, fat_per_100g: 6.9, fiber_per_100g: 10.6, sugar_per_100g: 1.0,
    defaultServingGrams: 40, defaultServingLabel: "40g", measures: { taza: 80, cucharada: 8 }
  },

  {
    name: "Pan integral", aliases: ["pan integral", "tostada integral", "pan de molde integral"],
    category: "Cereal", calories_per_100g: 247, protein_per_100g: 13.0, carbs_per_100g: 41.0, fat_per_100g: 4.2, fiber_per_100g: 6.0, sugar_per_100g: 5.0,
    defaultServingGrams: 30, defaultServingLabel: "1 rebanada", defaultUnitLabel: "rebanada", measures: { rebanada: 30 }
  },

  {
    name: "Pan blanco", aliases: ["pan blanco", "pan", "tostada", "pan de molde"],
    category: "Cereal", calories_per_100g: 266, protein_per_100g: 8.9, carbs_per_100g: 49.0, fat_per_100g: 3.2, fiber_per_100g: 2.4, sugar_per_100g: 5.0,
    defaultServingGrams: 30, defaultServingLabel: "1 rebanada", defaultUnitLabel: "rebanada", measures: { rebanada: 30 }
  },

  {
    name: "Tortilla de maíz", aliases: ["tortilla de maiz", "tortilla", "tortillas"],
    category: "Cereal", calories_per_100g: 218, protein_per_100g: 5.7, carbs_per_100g: 44.6, fat_per_100g: 2.9, fiber_per_100g: 6.3, sugar_per_100g: 0.6,
    defaultServingGrams: 30, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 30 }
  },

  {
    name: "Tortilla de trigo", aliases: ["tortilla de trigo", "wrap", "wraps"],
    category: "Cereal", calories_per_100g: 310, protein_per_100g: 8.0, carbs_per_100g: 52.0, fat_per_100g: 7.5, fiber_per_100g: 3.0, sugar_per_100g: 3.0,
    defaultServingGrams: 45, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 45 }
  },

  {
    name: "Pasta cocida", aliases: ["pasta", "espagueti", "espaguetis", "macarrones", "fideos", "tallarines", "spaghetti"],
    category: "Cereal", calories_per_100g: 157, protein_per_100g: 5.8, carbs_per_100g: 30.9, fat_per_100g: 0.9, fiber_per_100g: 1.8, sugar_per_100g: 0.6,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 140 }
  },

  {
    name: "Quinoa cocida", aliases: ["quinoa", "quinua"],
    category: "Cereal", calories_per_100g: 120, protein_per_100g: 4.4, carbs_per_100g: 21.3, fat_per_100g: 1.9, fiber_per_100g: 2.8, sugar_per_100g: 0.9,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 185 }
  },

  {
    name: "Harina de maíz (PAN)", aliases: ["harina pan", "harina de maiz", "harina precocida", "masarepa", "masa de arepa"],
    category: "Cereal", calories_per_100g: 365, protein_per_100g: 7.8, carbs_per_100g: 76.0, fat_per_100g: 2.5, fiber_per_100g: 5.0, sugar_per_100g: 0.5,
    defaultServingGrams: 40, defaultServingLabel: "40g", measures: { taza: 120, cucharada: 8 }
  },

  {
    name: "Granola", aliases: ["granola"],
    category: "Cereal", calories_per_100g: 471, protein_per_100g: 10.0, carbs_per_100g: 64.0, fat_per_100g: 20.0, fiber_per_100g: 6.5, sugar_per_100g: 22.0,
    defaultServingGrams: 40, defaultServingLabel: "40g", measures: { taza: 100, cucharada: 12 }
  },

  {
    name: "Corn flakes / cereal", aliases: ["corn flakes", "cereal de maiz", "cereal", "copos de maiz"],
    category: "Cereal", calories_per_100g: 357, protein_per_100g: 7.5, carbs_per_100g: 84.0, fat_per_100g: 0.4, fiber_per_100g: 3.0, sugar_per_100g: 8.0,
    defaultServingGrams: 30, defaultServingLabel: "30g", measures: { taza: 28 }
  },

  {
    name: "Galletas integrales", aliases: ["galleta integral", "galletas integrales", "galletas maria", "galleta maria"],
    category: "Cereal", calories_per_100g: 430, protein_per_100g: 8.0, carbs_per_100g: 70.0, fat_per_100g: 13.0, fiber_per_100g: 4.5, sugar_per_100g: 20.0,
    defaultServingGrams: 30, defaultServingLabel: "30g", measures: { unidad: 7, porcion: 30 }
  },

  {
    name: "Palomitas de maíz", aliases: ["palomitas", "palomitas de maiz", "maiz pira", "crispetas", "cotufas", "popcorn"],
    category: "Snack", calories_per_100g: 375, protein_per_100g: 11.0, carbs_per_100g: 74.0, fat_per_100g: 4.5, fiber_per_100g: 15.0, sugar_per_100g: 0.9,
    defaultServingGrams: 20, defaultServingLabel: "20g", measures: { taza: 8, porcion: 20 }
  },

  {
    name: "Chips de maíz / nachos", aliases: ["chips", "nachos", "doritos", "tostitos", "frituras de maiz", "chicharritos"],
    category: "Snack", calories_per_100g: 486, protein_per_100g: 7.5, carbs_per_100g: 64.0, fat_per_100g: 23.0, fiber_per_100g: 4.0, sugar_per_100g: 1.5,
    defaultServingGrams: 28, defaultServingLabel: "28g", measures: { porcion: 28 }
  },

  /* ── PROTEÍNA ANIMAL ── */
  {
    name: "Pechuga de pollo cocida", aliases: ["pollo", "pechuga de pollo", "pollo a la plancha", "pollo cocido", "pollo asado", "filete de pollo"],
    category: "Proteína", calories_per_100g: 165, protein_per_100g: 31.0, carbs_per_100g: 0.0, fat_per_100g: 3.6, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 120, defaultServingLabel: "120g", measures: { filete: 120, pechuga: 200 }
  },

  {
    name: "Pollo apanado / frito", aliases: ["pollo frito", "pollo apanado", "pollo broaster", "pollo rebozado"],
    category: "Proteína", calories_per_100g: 246, protein_per_100g: 20.0, carbs_per_100g: 15.0, fat_per_100g: 12.0, fiber_per_100g: 0.5, sugar_per_100g: 0.3,
    defaultServingGrams: 120, defaultServingLabel: "1 presa", defaultUnitLabel: "presa", measures: { presa: 120, pieza: 120 }
  },

  {
    name: "Huevo entero", aliases: ["huevo", "huevos", "huevo de gallina"],
    category: "Proteína", calories_per_100g: 143, protein_per_100g: 12.6, carbs_per_100g: 0.7, fat_per_100g: 9.5, fiber_per_100g: 0.0, sugar_per_100g: 0.4,
    defaultServingGrams: 50, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 50, pieza: 50 }
  },

  {
    name: "Clara de huevo", aliases: ["clara de huevo", "claras de huevo", "claras"],
    category: "Proteína", calories_per_100g: 52, protein_per_100g: 10.9, carbs_per_100g: 0.7, fat_per_100g: 0.2, fiber_per_100g: 0.0, sugar_per_100g: 0.7,
    defaultServingGrams: 33, defaultServingLabel: "1 clara", defaultUnitLabel: "unidad", measures: { unidad: 33, pieza: 33 }
  },

  {
    name: "Atún en agua", aliases: ["atun", "atún", "atun en agua", "lata de atun", "atun enlatado"],
    category: "Proteína", calories_per_100g: 116, protein_per_100g: 25.5, carbs_per_100g: 0.0, fat_per_100g: 0.8, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 120, defaultServingLabel: "1 lata", defaultUnitLabel: "lata", measures: { lata: 120 }
  },

  {
    name: "Salmón", aliases: ["salmon", "salmón", "salmon asado", "salmon a la plancha"],
    category: "Proteína", calories_per_100g: 208, protein_per_100g: 20.4, carbs_per_100g: 0.0, fat_per_100g: 13.4, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 120, defaultServingLabel: "120g", measures: { filete: 120 }
  },

  {
    name: "Sardinas en lata", aliases: ["sardinas", "sardina", "sardinas en aceite", "sardinas en tomate"],
    category: "Proteína", calories_per_100g: 208, protein_per_100g: 24.6, carbs_per_100g: 0.0, fat_per_100g: 11.5, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 100, defaultServingLabel: "1 lata", defaultUnitLabel: "lata", measures: { lata: 100 }
  },

  {
    name: "Tilapia cocida", aliases: ["tilapia", "mojarra", "mojarra frita"],
    category: "Proteína", calories_per_100g: 128, protein_per_100g: 26.2, carbs_per_100g: 0.0, fat_per_100g: 2.7, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 120, defaultServingLabel: "120g", measures: { filete: 120 }
  },

  {
    name: "Camarón cocido", aliases: ["camaron", "camarón", "gambas", "langostinos", "camarones"],
    category: "Proteína", calories_per_100g: 99, protein_per_100g: 24.0, carbs_per_100g: 0.2, fat_per_100g: 0.3, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 100, defaultServingLabel: "100g"
  },

  {
    name: "Carne de res magra cocida", aliases: ["carne de res", "res", "carne magra", "bistec", "carne de vaca", "lomito"],
    category: "Proteína", calories_per_100g: 217, protein_per_100g: 26.1, carbs_per_100g: 0.0, fat_per_100g: 11.8, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 120, defaultServingLabel: "120g", measures: { filete: 120 }
  },

  {
    name: "Carne molida de res", aliases: ["carne molida", "picadillo", "carne picada", "molida de res"],
    category: "Proteína", calories_per_100g: 215, protein_per_100g: 22.0, carbs_per_100g: 0.0, fat_per_100g: 14.0, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 100, defaultServingLabel: "100g"
  },

  {
    name: "Pavo cocido", aliases: ["pavo", "pechuga de pavo", "pavo asado"],
    category: "Proteína", calories_per_100g: 135, protein_per_100g: 29.0, carbs_per_100g: 0.0, fat_per_100g: 1.6, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { filete: 100, rebanada: 25 }
  },

  {
    name: "Lomo de cerdo cocido", aliases: ["cerdo", "lomo de cerdo", "lomo de puerco"],
    category: "Proteína", calories_per_100g: 196, protein_per_100g: 27.3, carbs_per_100g: 0.0, fat_per_100g: 8.2, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 120, defaultServingLabel: "120g", measures: { filete: 120 }
  },

  {
    name: "Tocino / tocineta", aliases: ["tocino", "tocineta", "bacon", "panceta", "tocineta frita"],
    category: "Proteína", calories_per_100g: 541, protein_per_100g: 37.0, carbs_per_100g: 1.4, fat_per_100g: 42.0, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 20, defaultServingLabel: "1 lonja", defaultUnitLabel: "lonja", measures: { lonja: 20, tira: 20, rebanada: 20 }
  },

  {
    name: "Chorizo", aliases: ["chorizo", "chorizo frito", "chorizo cocido"],
    category: "Proteína", calories_per_100g: 425, protein_per_100g: 18.0, carbs_per_100g: 2.0, fat_per_100g: 38.0, fiber_per_100g: 0.0, sugar_per_100g: 1.0,
    defaultServingGrams: 60, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 60, pieza: 60 }
  },

  {
    name: "Salchicha / hot dog", aliases: ["salchicha", "hot dog", "salchichas", "frankfurt", "vienesa"],
    category: "Proteína", calories_per_100g: 290, protein_per_100g: 11.0, carbs_per_100g: 3.5, fat_per_100g: 26.0, fiber_per_100g: 0.0, sugar_per_100g: 2.0,
    defaultServingGrams: 50, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 50, pieza: 50 }
  },

  {
    name: "Jamón de pavo", aliases: ["jamon de pavo", "jamón de pavo", "jamon"],
    category: "Proteína", calories_per_100g: 112, protein_per_100g: 17.0, carbs_per_100g: 3.0, fat_per_100g: 3.0, fiber_per_100g: 0.0, sugar_per_100g: 1.0,
    defaultServingGrams: 30, defaultServingLabel: "1 rebanada", defaultUnitLabel: "rebanada", measures: { rebanada: 30 }
  },

  {
    name: "Mortadela", aliases: ["mortadela", "mortadella"],
    category: "Proteína", calories_per_100g: 311, protein_per_100g: 12.0, carbs_per_100g: 3.0, fat_per_100g: 28.0, fiber_per_100g: 0.0, sugar_per_100g: 1.5,
    defaultServingGrams: 30, defaultServingLabel: "1 rebanada", defaultUnitLabel: "rebanada", measures: { rebanada: 30 }
  },

  {
    name: "Chicharrón de cerdo", aliases: ["chicharron", "chicharrón", "chicharrones", "cuero frito"],
    category: "Proteína", calories_per_100g: 544, protein_per_100g: 34.0, carbs_per_100g: 0.0, fat_per_100g: 45.0, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 30, defaultServingLabel: "30g", measures: { porcion: 30 }
  },

  {
    name: "Proteína whey en polvo", aliases: ["whey", "proteina en polvo", "proteína en polvo", "suero proteico", "proteina whey"],
    category: "Proteína", calories_per_100g: 400, protein_per_100g: 80.0, carbs_per_100g: 8.0, fat_per_100g: 5.0, fiber_per_100g: 0.0, sugar_per_100g: 5.0,
    defaultServingGrams: 30, defaultServingLabel: "1 scoop", defaultUnitLabel: "scoop", measures: { scoop: 30, cucharada: 15 }
  },

  /* ── LEGUMBRES ── */
  {
    name: "Lentejas cocidas", aliases: ["lenteja", "lentejas"],
    category: "Legumbre", calories_per_100g: 116, protein_per_100g: 9.0, carbs_per_100g: 20.1, fat_per_100g: 0.4, fiber_per_100g: 7.9, sugar_per_100g: 1.8,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 198, cucharada: 12 }
  },

  {
    name: "Frijoles negros cocidos", aliases: ["frijoles", "frijol", "frijoles negros", "caraotas", "porotos negros", "habichuelas negras"],
    category: "Legumbre", calories_per_100g: 132, protein_per_100g: 8.9, carbs_per_100g: 23.7, fat_per_100g: 0.5, fiber_per_100g: 8.7, sugar_per_100g: 0.3,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 172, cucharada: 12 }
  },

  {
    name: "Garbanzos cocidos", aliases: ["garbanzo", "garbanzos"],
    category: "Legumbre", calories_per_100g: 164, protein_per_100g: 8.9, carbs_per_100g: 27.4, fat_per_100g: 2.6, fiber_per_100g: 7.6, sugar_per_100g: 4.8,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 164 }
  },

  {
    name: "Tofu firme", aliases: ["tofu", "tofu firme", "soja"],
    category: "Legumbre", calories_per_100g: 76, protein_per_100g: 8.0, carbs_per_100g: 1.9, fat_per_100g: 4.8, fiber_per_100g: 0.3, sugar_per_100g: 0.6,
    defaultServingGrams: 100, defaultServingLabel: "100g"
  },

  /* ── TRADICIONAL / LATAM ── */
  {
    name: "Arepa de maíz", aliases: ["arepa", "arepas", "arepa blanca", "arepa de maiz"],
    category: "Tradicional", calories_per_100g: 218, protein_per_100g: 5.5, carbs_per_100g: 43.0, fat_per_100g: 2.8, fiber_per_100g: 2.5, sugar_per_100g: 1.2,
    defaultServingGrams: 90, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 90 }
  },

  {
    name: "Pandebono / pan de bono", aliases: ["pandebono", "pan de bono", "pan bono", "almojabana", "almojábana"],
    category: "Tradicional", calories_per_100g: 360, protein_per_100g: 9.0, carbs_per_100g: 52.0, fat_per_100g: 13.0, fiber_per_100g: 0.5, sugar_per_100g: 4.0,
    defaultServingGrams: 50, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 50 }
  },

  {
    name: "Empanada de maíz", aliases: ["empanada", "empanadas", "empanada de pipian", "empanada criolla"],
    category: "Tradicional", calories_per_100g: 250, protein_per_100g: 8.5, carbs_per_100g: 32.0, fat_per_100g: 10.0, fiber_per_100g: 1.5, sugar_per_100g: 1.0,
    defaultServingGrams: 80, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 80 }
  },

  {
    name: "Patacón / plátano verde frito", aliases: ["patacon", "patacón", "patacones", "tostón", "tostones", "platano verde frito"],
    category: "Tradicional", calories_per_100g: 230, protein_per_100g: 2.0, carbs_per_100g: 38.0, fat_per_100g: 8.5, fiber_per_100g: 2.0, sugar_per_100g: 3.0,
    defaultServingGrams: 50, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 50 }
  },

  /* ── TUBÉRCULOS ── */
  {
    name: "Papa cocida", aliases: ["papa", "papas", "patata", "patatas", "papa cocinada"],
    category: "Tubérculo", calories_per_100g: 87, protein_per_100g: 1.9, carbs_per_100g: 20.1, fat_per_100g: 0.1, fiber_per_100g: 1.8, sugar_per_100g: 0.9,
    defaultServingGrams: 150, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 150 }
  },

  {
    name: "Camote cocido", aliases: ["camote", "batata", "boniato", "papa dulce"],
    category: "Tubérculo", calories_per_100g: 90, protein_per_100g: 2.0, carbs_per_100g: 20.7, fat_per_100g: 0.2, fiber_per_100g: 3.3, sugar_per_100g: 6.5,
    defaultServingGrams: 130, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 130 }
  },

  {
    name: "Yuca cocida", aliases: ["yuca", "mandioca", "cassava", "yuca cocida"],
    category: "Tubérculo", calories_per_100g: 160, protein_per_100g: 1.4, carbs_per_100g: 38.1, fat_per_100g: 0.3, fiber_per_100g: 1.8, sugar_per_100g: 1.7,
    defaultServingGrams: 100, defaultServingLabel: "100g"
  },

  {
    name: "Maíz cocido", aliases: ["maiz", "maíz", "choclo", "elote", "jojoto", "mazorca"],
    category: "Tubérculo", calories_per_100g: 96, protein_per_100g: 3.4, carbs_per_100g: 21.0, fat_per_100g: 1.5, fiber_per_100g: 2.4, sugar_per_100g: 4.5,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 165 }
  },

  /* ── GRASAS SALUDABLES ── */
  {
    name: "Aguacate", aliases: ["aguacate", "palta", "avocado"],
    category: "Grasa saludable", calories_per_100g: 160, protein_per_100g: 2.0, carbs_per_100g: 8.5, fat_per_100g: 14.7, fiber_per_100g: 6.7, sugar_per_100g: 0.7,
    defaultServingGrams: 150, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 150, mitad: 75 }
  },

  {
    name: "Aceite de oliva", aliases: ["aceite de oliva", "aceite", "aceite vegetal"],
    category: "Grasa saludable", calories_per_100g: 884, protein_per_100g: 0.0, carbs_per_100g: 0.0, fat_per_100g: 100.0, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 14, defaultServingLabel: "1 cucharada", defaultUnitLabel: "cucharada", measures: { cucharada: 14, cucharadita: 5 }
  },

  {
    name: "Almendras", aliases: ["almendra", "almendras"],
    category: "Snack", calories_per_100g: 579, protein_per_100g: 21.2, carbs_per_100g: 21.6, fat_per_100g: 49.9, fiber_per_100g: 12.5, sugar_per_100g: 4.4,
    defaultServingGrams: 28, defaultServingLabel: "1 porción", defaultUnitLabel: "porcion", measures: { porcion: 28, cucharada: 9 }
  },

  {
    name: "Maní / cacahuate", aliases: ["mani", "maní", "cacahuate", "cacahuates", "cacahuete", "cacahuetes", "manises"],
    category: "Snack", calories_per_100g: 567, protein_per_100g: 25.8, carbs_per_100g: 16.1, fat_per_100g: 49.2, fiber_per_100g: 8.5, sugar_per_100g: 4.7,
    defaultServingGrams: 28, defaultServingLabel: "1 porción", defaultUnitLabel: "porcion", measures: { porcion: 28, cucharada: 16 }
  },

  {
    name: "Nueces", aliases: ["nuez", "nueces", "walnuts"],
    category: "Snack", calories_per_100g: 654, protein_per_100g: 15.2, carbs_per_100g: 13.7, fat_per_100g: 65.2, fiber_per_100g: 6.7, sugar_per_100g: 2.6,
    defaultServingGrams: 28, defaultServingLabel: "1 porción", defaultUnitLabel: "porcion", measures: { porcion: 28 }
  },

  {
    name: "Mantequilla de maní", aliases: ["mantequilla de mani", "mantequilla de cacahuate", "peanut butter", "crema de mani"],
    category: "Snack", calories_per_100g: 588, protein_per_100g: 25.0, carbs_per_100g: 20.0, fat_per_100g: 50.0, fiber_per_100g: 6.0, sugar_per_100g: 9.0,
    defaultServingGrams: 32, defaultServingLabel: "2 cucharadas", measures: { cucharada: 16 }
  },

  {
    name: "Semillas de chía", aliases: ["chia", "chía", "semillas de chia"],
    category: "Snack", calories_per_100g: 486, protein_per_100g: 16.5, carbs_per_100g: 42.0, fat_per_100g: 30.7, fiber_per_100g: 34.4, sugar_per_100g: 0.0,
    defaultServingGrams: 15, defaultServingLabel: "1 cucharada", measures: { cucharada: 15 }
  },

  {
    name: "Chocolate negro 70%", aliases: ["chocolate negro", "chocolate oscuro", "chocolate amargo", "cacao"],
    category: "Snack", calories_per_100g: 598, protein_per_100g: 7.8, carbs_per_100g: 46.0, fat_per_100g: 43.0, fiber_per_100g: 10.9, sugar_per_100g: 24.0,
    defaultServingGrams: 30, defaultServingLabel: "30g", measures: { porcion: 30, cuadrito: 5 }
  },

  /* ── LÁCTEOS ── */
  {
    name: "Queso fresco", aliases: ["queso fresco", "queso blanco", "queso", "quesillo", "queso de mano", "queso llanero"],
    category: "Lácteo", calories_per_100g: 299, protein_per_100g: 18.1, carbs_per_100g: 3.7, fat_per_100g: 23.5, fiber_per_100g: 0.0, sugar_per_100g: 1.5,
    defaultServingGrams: 30, defaultServingLabel: "1 rebanada", defaultUnitLabel: "rebanada", measures: { rebanada: 30 }
  },

  {
    name: "Queso mozzarella", aliases: ["mozzarella", "mozarela", "queso mozarela", "queso mozzarella"],
    category: "Lácteo", calories_per_100g: 280, protein_per_100g: 28.0, carbs_per_100g: 2.2, fat_per_100g: 17.0, fiber_per_100g: 0.0, sugar_per_100g: 1.0,
    defaultServingGrams: 30, defaultServingLabel: "30g", measures: { rebanada: 30 }
  },

  {
    name: "Queso cheddar", aliases: ["cheddar", "queso cheddar", "queso amarillo"],
    category: "Lácteo", calories_per_100g: 402, protein_per_100g: 25.0, carbs_per_100g: 1.3, fat_per_100g: 33.0, fiber_per_100g: 0.0, sugar_per_100g: 0.5,
    defaultServingGrams: 30, defaultServingLabel: "1 rebanada", defaultUnitLabel: "rebanada", measures: { rebanada: 30 }
  },

  {
    name: "Queso parmesano", aliases: ["parmesano", "queso parmesano", "parmigiano"],
    category: "Lácteo", calories_per_100g: 420, protein_per_100g: 38.0, carbs_per_100g: 0.0, fat_per_100g: 29.0, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 10, defaultServingLabel: "1 cucharada", measures: { cucharada: 10 }
  },

  {
    name: "Yogur natural sin azúcar", aliases: ["yogur natural", "yogurt natural", "yogur", "yogurt"],
    category: "Lácteo", calories_per_100g: 61, protein_per_100g: 3.5, carbs_per_100g: 4.7, fat_per_100g: 3.3, fiber_per_100g: 0.0, sugar_per_100g: 4.7,
    defaultServingGrams: 125, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 125, vaso: 200, taza: 245 }
  },

  {
    name: "Yogur griego", aliases: ["yogur griego", "yogurt griego", "yogur proteico"],
    category: "Lácteo", calories_per_100g: 97, protein_per_100g: 10.0, carbs_per_100g: 3.6, fat_per_100g: 5.0, fiber_per_100g: 0.0, sugar_per_100g: 3.2,
    defaultServingGrams: 150, defaultServingLabel: "150g", measures: { unidad: 150, taza: 240 }
  },

  {
    name: "Leche semidescremada", aliases: ["leche", "leche semidescremada", "leche de vaca"],
    category: "Lácteo", calories_per_100g: 50, protein_per_100g: 3.4, carbs_per_100g: 4.8, fat_per_100g: 1.8, fiber_per_100g: 0.0, sugar_per_100g: 5.0,
    defaultServingGrams: 100, defaultServingLabel: "100ml", measures: { vaso: 240, taza: 240 }
  },

  {
    name: "Mantequilla", aliases: ["mantequilla", "margarina", "butter"],
    category: "Lácteo", calories_per_100g: 717, protein_per_100g: 0.9, carbs_per_100g: 0.1, fat_per_100g: 81.0, fiber_per_100g: 0.0, sugar_per_100g: 0.1,
    defaultServingGrams: 10, defaultServingLabel: "1 cucharadita", measures: { cucharadita: 5, cucharada: 14 }
  },

  {
    name: "Crema de leche", aliases: ["crema de leche", "nata", "nata para cocinar", "heavy cream"],
    category: "Lácteo", calories_per_100g: 340, protein_per_100g: 2.1, carbs_per_100g: 2.9, fat_per_100g: 35.0, fiber_per_100g: 0.0, sugar_per_100g: 2.9,
    defaultServingGrams: 30, defaultServingLabel: "2 cucharadas", measures: { cucharada: 15 }
  },

  {
    name: "Arequipe / dulce de leche", aliases: ["arequipe", "dulce de leche", "manjar blanco", "cajeta", "manjar"],
    category: "Lácteo", calories_per_100g: 328, protein_per_100g: 6.7, carbs_per_100g: 57.0, fat_per_100g: 8.0, fiber_per_100g: 0.0, sugar_per_100g: 54.0,
    defaultServingGrams: 20, defaultServingLabel: "1 cucharada", measures: { cucharada: 20 }
  },

  /* ── FRUTAS ── */
  {
    name: "Plátano / banana", aliases: ["platano", "plátano", "banana", "banano", "cambur", "guineo"],
    category: "Fruta", calories_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 22.8, fat_per_100g: 0.3, fiber_per_100g: 2.6, sugar_per_100g: 12.2,
    defaultServingGrams: 120, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 120 }
  },

  {
    name: "Manzana", aliases: ["manzana", "manzanas"],
    category: "Fruta", calories_per_100g: 52, protein_per_100g: 0.3, carbs_per_100g: 13.8, fat_per_100g: 0.2, fiber_per_100g: 2.4, sugar_per_100g: 10.4,
    defaultServingGrams: 180, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 180 }
  },

  {
    name: "Naranja", aliases: ["naranja", "naranjas"],
    category: "Fruta", calories_per_100g: 47, protein_per_100g: 0.9, carbs_per_100g: 11.8, fat_per_100g: 0.1, fiber_per_100g: 2.4, sugar_per_100g: 9.4,
    defaultServingGrams: 140, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 140 }
  },

  {
    name: "Mango", aliases: ["mango", "mangos", "mango maduro"],
    category: "Fruta", calories_per_100g: 60, protein_per_100g: 0.8, carbs_per_100g: 15.0, fat_per_100g: 0.4, fiber_per_100g: 1.6, sugar_per_100g: 13.7,
    defaultServingGrams: 200, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 200, taja: 100 }
  },

  {
    name: "Papaya", aliases: ["papaya", "lechosa", "fruta bomba", "mamón"],
    category: "Fruta", calories_per_100g: 43, protein_per_100g: 0.5, carbs_per_100g: 11.0, fat_per_100g: 0.3, fiber_per_100g: 1.7, sugar_per_100g: 7.8,
    defaultServingGrams: 150, defaultServingLabel: "1 taza", measures: { taza: 150 }
  },

  {
    name: "Piña", aliases: ["piña", "pina", "ananá", "anana", "ananás"],
    category: "Fruta", calories_per_100g: 50, protein_per_100g: 0.5, carbs_per_100g: 13.1, fat_per_100g: 0.1, fiber_per_100g: 1.4, sugar_per_100g: 9.9,
    defaultServingGrams: 150, defaultServingLabel: "1 taza", measures: { taza: 150, rodaja: 100 }
  },

  {
    name: "Fresa / frutilla", aliases: ["fresa", "fresas", "frutilla", "frutillas", "frutilla roja"],
    category: "Fruta", calories_per_100g: 32, protein_per_100g: 0.7, carbs_per_100g: 7.7, fat_per_100g: 0.3, fiber_per_100g: 2.0, sugar_per_100g: 4.9,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 152 }
  },

  {
    name: "Uvas", aliases: ["uva", "uvas", "uva roja", "uva verde"],
    category: "Fruta", calories_per_100g: 67, protein_per_100g: 0.6, carbs_per_100g: 17.2, fat_per_100g: 0.4, fiber_per_100g: 0.9, sugar_per_100g: 16.3,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 92 }
  },

  {
    name: "Sandía", aliases: ["sandia", "sandía", "patilla", "melón de agua"],
    category: "Fruta", calories_per_100g: 30, protein_per_100g: 0.6, carbs_per_100g: 7.6, fat_per_100g: 0.2, fiber_per_100g: 0.4, sugar_per_100g: 6.2,
    defaultServingGrams: 200, defaultServingLabel: "1 tajada", measures: { taza: 152, tajada: 200 }
  },

  {
    name: "Mandarina", aliases: ["mandarina", "mandarinas", "tangerina"],
    category: "Fruta", calories_per_100g: 53, protein_per_100g: 0.8, carbs_per_100g: 13.3, fat_per_100g: 0.3, fiber_per_100g: 1.8, sugar_per_100g: 10.6,
    defaultServingGrams: 90, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 90 }
  },

  {
    name: "Melocotón / durazno", aliases: ["melocoton", "melocotón", "durazno", "duraznos", "nectarina"],
    category: "Fruta", calories_per_100g: 39, protein_per_100g: 0.9, carbs_per_100g: 9.5, fat_per_100g: 0.25, fiber_per_100g: 1.5, sugar_per_100g: 8.4,
    defaultServingGrams: 130, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 130 }
  },

  {
    name: "Pera", aliases: ["pera", "peras"],
    category: "Fruta", calories_per_100g: 57, protein_per_100g: 0.4, carbs_per_100g: 15.2, fat_per_100g: 0.1, fiber_per_100g: 3.1, sugar_per_100g: 9.8,
    defaultServingGrams: 160, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 160 }
  },

  {
    name: "Guayaba", aliases: ["guayaba", "guava"],
    category: "Fruta", calories_per_100g: 68, protein_per_100g: 2.6, carbs_per_100g: 14.3, fat_per_100g: 1.0, fiber_per_100g: 5.4, sugar_per_100g: 8.9,
    defaultServingGrams: 90, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 90 }
  },

  {
    name: "Maracuyá / parchita", aliases: ["maracuya", "maracuyá", "parchita", "passion fruit", "granadilla"],
    category: "Fruta", calories_per_100g: 97, protein_per_100g: 2.2, carbs_per_100g: 23.4, fat_per_100g: 0.7, fiber_per_100g: 10.4, sugar_per_100g: 11.2,
    defaultServingGrams: 50, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 50 }
  },

  {
    name: "Mora", aliases: ["mora", "moras", "blackberry"],
    category: "Fruta", calories_per_100g: 43, protein_per_100g: 1.4, carbs_per_100g: 9.6, fat_per_100g: 0.5, fiber_per_100g: 5.3, sugar_per_100g: 4.9,
    defaultServingGrams: 80, defaultServingLabel: "80g", measures: { taza: 144 }
  },

  /* ── VERDURAS Y HORTALIZAS ── */
  {
    name: "Tomate", aliases: ["tomate", "tomates", "tomato"],
    category: "Verdura", calories_per_100g: 18, protein_per_100g: 0.9, carbs_per_100g: 3.9, fat_per_100g: 0.2, fiber_per_100g: 1.2, sugar_per_100g: 2.6,
    defaultServingGrams: 120, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 120 }
  },

  {
    name: "Cebolla", aliases: ["cebolla", "cebollas", "cebolla blanca", "cebolla morada"],
    category: "Verdura", calories_per_100g: 40, protein_per_100g: 1.1, carbs_per_100g: 9.3, fat_per_100g: 0.1, fiber_per_100g: 1.7, sugar_per_100g: 4.2,
    defaultServingGrams: 110, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 110 }
  },

  {
    name: "Brócoli cocido", aliases: ["brocoli", "brócoli", "brocoli cocido"],
    category: "Verdura", calories_per_100g: 35, protein_per_100g: 2.4, carbs_per_100g: 7.2, fat_per_100g: 0.4, fiber_per_100g: 3.3, sugar_per_100g: 1.4,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 156 }
  },

  {
    name: "Espinaca", aliases: ["espinaca", "espinacas"],
    category: "Verdura", calories_per_100g: 23, protein_per_100g: 2.9, carbs_per_100g: 3.6, fat_per_100g: 0.4, fiber_per_100g: 2.2, sugar_per_100g: 0.4,
    defaultServingGrams: 50, defaultServingLabel: "50g", measures: { taza: 30 }
  },

  {
    name: "Zanahoria", aliases: ["zanahoria", "zanahorias"],
    category: "Verdura", calories_per_100g: 41, protein_per_100g: 0.9, carbs_per_100g: 9.6, fat_per_100g: 0.2, fiber_per_100g: 2.8, sugar_per_100g: 4.7,
    defaultServingGrams: 60, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 60 }
  },

  {
    name: "Pepino", aliases: ["pepino", "pepinos", "cucumber"],
    category: "Verdura", calories_per_100g: 15, protein_per_100g: 0.7, carbs_per_100g: 3.6, fat_per_100g: 0.1, fiber_per_100g: 0.5, sugar_per_100g: 1.7,
    defaultServingGrams: 200, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 200 }
  },

  {
    name: "Lechuga", aliases: ["lechuga", "ensalada", "lechuga romana", "lechuga criolla"],
    category: "Verdura", calories_per_100g: 15, protein_per_100g: 1.4, carbs_per_100g: 2.9, fat_per_100g: 0.2, fiber_per_100g: 1.3, sugar_per_100g: 1.2,
    defaultServingGrams: 50, defaultServingLabel: "50g", measures: { taza: 36 }
  },

  {
    name: "Pimentón / pimiento", aliases: ["pimenton", "pimentón", "pimiento", "ají dulce", "capsicum", "chile dulce"],
    category: "Verdura", calories_per_100g: 20, protein_per_100g: 0.9, carbs_per_100g: 4.6, fat_per_100g: 0.2, fiber_per_100g: 1.7, sugar_per_100g: 2.4,
    defaultServingGrams: 120, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 120 }
  },

  {
    name: "Champiñones", aliases: ["champiñon", "champiñones", "hongos", "setas", "mushrooms"],
    category: "Verdura", calories_per_100g: 22, protein_per_100g: 3.1, carbs_per_100g: 3.3, fat_per_100g: 0.3, fiber_per_100g: 1.0, sugar_per_100g: 2.0,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 70 }
  },

  {
    name: "Calabaza / zapallo", aliases: ["calabaza", "zapallo", "auyama", "ahuyama", "squash", "winter squash"],
    category: "Verdura", calories_per_100g: 26, protein_per_100g: 1.0, carbs_per_100g: 6.5, fat_per_100g: 0.1, fiber_per_100g: 0.5, sugar_per_100g: 2.8,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 116 }
  },

  {
    name: "Coliflor", aliases: ["coliflor", "coliflores", "cauliflower"],
    category: "Verdura", calories_per_100g: 25, protein_per_100g: 2.0, carbs_per_100g: 5.0, fat_per_100g: 0.3, fiber_per_100g: 2.0, sugar_per_100g: 1.9,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 107 }
  },

  {
    name: "Repollo / col", aliases: ["repollo", "col", "cabbage", "col blanca"],
    category: "Verdura", calories_per_100g: 25, protein_per_100g: 1.3, carbs_per_100g: 5.8, fat_per_100g: 0.1, fiber_per_100g: 2.5, sugar_per_100g: 3.2,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 89 }
  },

  {
    name: "Remolacha", aliases: ["remolacha", "betabel", "beterraga", "beet", "remolacha cocida"],
    category: "Verdura", calories_per_100g: 44, protein_per_100g: 1.7, carbs_per_100g: 10.0, fat_per_100g: 0.2, fiber_per_100g: 2.0, sugar_per_100g: 7.6,
    defaultServingGrams: 80, defaultServingLabel: "1 unidad", defaultUnitLabel: "unidad", measures: { unidad: 80 }
  },

  {
    name: "Apio", aliases: ["apio", "celery", "apio españa"],
    category: "Verdura", calories_per_100g: 16, protein_per_100g: 0.7, carbs_per_100g: 3.0, fat_per_100g: 0.2, fiber_per_100g: 1.6, sugar_per_100g: 1.3,
    defaultServingGrams: 40, defaultServingLabel: "1 tallo", defaultUnitLabel: "tallo", measures: { tallo: 40 }
  },

  /* ── BEBIDAS ── */
  {
    name: "Café negro", aliases: ["cafe negro", "café negro", "cafe", "café", "tinto", "espresso", "americano"],
    category: "Bebida", calories_per_100g: 2, protein_per_100g: 0.1, carbs_per_100g: 0.0, fat_per_100g: 0.0, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 240, defaultServingLabel: "1 taza", defaultUnitLabel: "taza", measures: { taza: 240, vaso: 240 }
  },

  {
    name: "Jugo de naranja natural", aliases: ["jugo de naranja", "zumo de naranja", "jugo natural", "jugo"],
    category: "Bebida", calories_per_100g: 45, protein_per_100g: 0.7, carbs_per_100g: 10.4, fat_per_100g: 0.2, fiber_per_100g: 0.2, sugar_per_100g: 8.4,
    defaultServingGrams: 240, defaultServingLabel: "1 vaso", defaultUnitLabel: "vaso", measures: { vaso: 240, taza: 240 }
  },

  {
    name: "Té sin azúcar", aliases: ["te", "té", "infusion", "infusión", "te verde", "té verde", "te negro", "té negro"],
    category: "Bebida", calories_per_100g: 1, protein_per_100g: 0.0, carbs_per_100g: 0.2, fat_per_100g: 0.0, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 240, defaultServingLabel: "1 taza", defaultUnitLabel: "taza", measures: { taza: 240, vaso: 240 }
  },

  {
    name: "Arroz con leche", aliases: ["arroz con leche", "postre de arroz"],
    category: "Postre", calories_per_100g: 130, protein_per_100g: 3.0, carbs_per_100g: 22.0, fat_per_100g: 3.5, fiber_per_100g: 0.2, sugar_per_100g: 12.0,
    defaultServingGrams: 150, defaultServingLabel: "1 taza", measures: { taza: 150 }
  },

  {
    name: "Ensalada mixta", aliases: ["ensalada", "ensalada verde", "ensalada mixta", "ensalada de lechuga"],
    category: "Verdura", calories_per_100g: 15, protein_per_100g: 1.0, carbs_per_100g: 2.5, fat_per_100g: 0.2, fiber_per_100g: 1.5, sugar_per_100g: 1.0,
    defaultServingGrams: 100, defaultServingLabel: "100g", measures: { taza: 55 }
  },

  {
    name: "Aceite de coco", aliases: ["aceite de coco", "coconut oil"],
    category: "Grasa saludable", calories_per_100g: 862, protein_per_100g: 0.0, carbs_per_100g: 0.0, fat_per_100g: 100.0, fiber_per_100g: 0.0, sugar_per_100g: 0.0,
    defaultServingGrams: 14, defaultServingLabel: "1 cucharada", defaultUnitLabel: "cucharada", measures: { cucharada: 14, cucharadita: 5 }
  },

  {
    name: "Linaza / semillas de lino", aliases: ["linaza", "lino", "semillas de lino", "flaxseed"],
    category: "Snack", calories_per_100g: 534, protein_per_100g: 18.3, carbs_per_100g: 28.9, fat_per_100g: 42.2, fiber_per_100g: 27.3, sugar_per_100g: 1.5,
    defaultServingGrams: 10, defaultServingLabel: "1 cucharada", measures: { cucharada: 10 }
  },

  {
    name: "Pimiento morrón asado", aliases: ["pimiento asado", "morrón", "pimiento rojo asado", "ajies asados"],
    category: "Verdura", calories_per_100g: 27, protein_per_100g: 0.8, carbs_per_100g: 6.7, fat_per_100g: 0.2, fiber_per_100g: 1.9, sugar_per_100g: 4.2,
    defaultServingGrams: 80, defaultServingLabel: "80g"
  },

  {
    name: "Sopa de pollo casera", aliases: ["sopa de pollo", "caldo de pollo", "sopa casera"],
    category: "Tradicional", calories_per_100g: 45, protein_per_100g: 4.0, carbs_per_100g: 3.5, fat_per_100g: 1.5, fiber_per_100g: 0.3, sugar_per_100g: 0.5,
    defaultServingGrams: 300, defaultServingLabel: "1 plato", defaultUnitLabel: "plato", measures: { plato: 300, taza: 240 }
  },
];
export const SYNONYMS_MAP = {
  // Frutas regionales
  'palta': 'aguacate',
  'avocado': 'aguacate',
  'banano': 'platano',
  'banana': 'platano',
  'cambur': 'platano',
  'guineo': 'platano',
  'frutilla': 'fresa',
  'anana': 'piña',
  'ananá': 'piña',
  'durazno': 'melocoton',
  'duraznos': 'melocoton',
  'nectarina': 'melocoton',
  'patilla': 'sandia',
  'lechosa': 'papaya',
  'fruta bomba': 'papaya',
  'mamonas': 'papaya',
  'parchita': 'maracuya',
  'granadilla': 'maracuya',
  'blackberry': 'mora',
  // Verduras / tubérculos
  'patata': 'papa',
  'batata': 'camote',
  'boniato': 'camote',
  'yam': 'camote',
  'mandioca': 'yuca',
  'cassava': 'yuca',
  'choclo': 'maiz',
  'elote': 'maiz',
  'jojoto': 'maiz',
  'mazorca': 'maiz',
  'ñame': 'yuca',
  'auyama': 'calabaza',
  'ahuyama': 'calabaza',
  'zapallo': 'calabaza',
  'betabel': 'remolacha',
  'beterraga': 'remolacha',
  'pimenton': 'pimenton',
  'ají dulce': 'pimenton',
  'chile dulce': 'pimenton',
  'col': 'repollo',
  'couve': 'repollo',
  'hongos': 'champiñones',
  'setas': 'champiñones',
  // Proteínas / carnes
  'tocineta': 'tocino',
  'bacon': 'tocino',
  'panceta': 'tocino',
  'res': 'carne de res',
  'bistec': 'carne de res',
  'lomito': 'carne de res',
  'molida': 'carne molida',
  'picadillo': 'carne molida',
  'gamba': 'camaron',
  'gambas': 'camaron',
  'langostino': 'camaron',
  'langostinos': 'camaron',
  'mojarra': 'tilapia',
  'pabellón': 'arroz',     // aproximación
  'quesillo': 'queso fresco',
  'queso de mano': 'queso fresco',
  'queso llanero': 'queso fresco',
  'queso blanco': 'queso fresco',
  // Lácteos / derivados
  'arequipe': 'arequipe',
  'manjar': 'arequipe',
  'cajeta': 'arequipe',
  'manjar blanco': 'arequipe',
  'dulce de leche': 'arequipe',
  'butter': 'mantequilla',
  'margarina': 'mantequilla',
  // Granos / legumbres
  'caraotas': 'frijoles negros',
  'carotas': 'frijoles negros',
  'porotos': 'frijoles negros',
  'habichuelas': 'frijoles negros',
  'quinua': 'quinoa',
  'soja': 'tofu',
  // Snacks / bebidas
  'cacahuate': 'mani',
  'cacahuates': 'mani',
  'cacahuete': 'mani',
  'cacahuetes': 'mani',
  'maiz pira': 'palomitas',
  'crispetas': 'palomitas',
  'cotufas': 'palomitas',
  'pop corn': 'palomitas',
  'popcorn': 'palomitas',
  'doritos': 'chips de maiz',
  'tostitos': 'chips de maiz',
  'nachos': 'chips de maiz',
  'tinto': 'cafe negro',
  'espresso': 'cafe negro',
  'americano': 'cafe negro',
  'zumo': 'jugo de naranja',
  // Comidas tradicionales
  'patacon': 'plátano verde frito',
  'patacones': 'plátano verde frito',
  'tostones': 'plátano verde frito',
  'toston': 'plátano verde frito',
  'creps': 'pan blanco',    // aproximación
  'hotcakes': 'pan blanco',    // aproximación
  'oatmeal': 'avena',
  'oats': 'avena',
  'wrap': 'tortilla de trigo',
  'wraps': 'tortilla de trigo',
  'spaghetti': 'pasta',
  'tallarines': 'pasta',
  'macarron': 'pasta',
  'macarrones': 'pasta',
  'fideos': 'pasta',
  'peanut butter': 'mantequilla de mani',
  'crema de mani': 'mantequilla de mani',
  'whey': 'proteina whey',
  'suero proteico': 'proteina whey',
  'frankfurt': 'salchicha',
  'vienesa': 'salchicha',
  'hot dog': 'salchicha',
  'almojabana': 'pandebono',
  'almojábana': 'pandebono',
  'pan bono': 'pandebono',
};

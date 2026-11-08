// Keep existing category values so previously saved products remain searchable.
export const categorySectors = [
  { name: "Mercearia", categories: ["Mercearia", "Arroz e grãos", "Feijão e leguminosas", "Massas", "Farinhas e cereais", "Açúcar e adoçantes", "Óleos e azeites", "Café e chás", "Molhos e condimentos", "Enlatados e conservas", "Biscoitos e bolachas", "Doces e chocolates", "Snacks e salgadinhos"] },
  { name: "Hortifrúti", categories: ["Hortifrúti", "Frutas", "Verduras", "Legumes", "Ervas e temperos frescos"] },
  { name: "Açougue e peixaria", categories: ["Carnes bovinas", "Carnes suínas", "Aves", "Peixes e frutos do mar"] },
  { name: "Frios e laticínios", categories: ["Laticínios", "Leites", "Queijos", "Iogurtes", "Manteigas e margarinas", "Frios e embutidos", "Ovos"] },
  { name: "Padaria", categories: ["Padaria", "Pães", "Bolos e confeitaria"] },
  { name: "Congelados", categories: ["Vegetais congelados", "Pratos prontos congelados", "Sorvetes e sobremesas"] },
  { name: "Bebidas", categories: ["Águas", "Sucos e néctares", "Refrigerantes", "Energéticos e isotônicos", "Cervejas", "Vinhos e destilados"] },
  { name: "Limpeza", categories: ["Limpeza", "Lavanderia", "Limpeza da casa", "Detergentes e lava-louças", "Esponjas e acessórios de limpeza"] },
  { name: "Higiene e cuidados pessoais", categories: ["Higiene", "Higiene bucal", "Cabelos", "Sabonetes e banho", "Desodorantes", "Papel higiênico", "Cuidados femininos"] },
  { name: "Bebês", categories: ["Fraldas e lenços umedecidos", "Alimentação infantil", "Higiene do bebê"] },
  { name: "Pet", categories: ["Alimentos para cães", "Alimentos para gatos", "Higiene e acessórios pet"] },
  { name: "Bazar e utilidades", categories: ["Descartáveis", "Utensílios domésticos", "Pilhas e lâmpadas"] },
];

export const categories = categorySectors.flatMap((sector) => sector.categories);
/** Sector name of a category ("Outros" when unknown). */
export const sectorOf = (category: string) => categorySectors.find((s) => (s.categories as readonly string[]).includes(category))?.name ?? "Outros";

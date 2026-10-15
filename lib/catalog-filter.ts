import type {Product} from './catalog';
export type CatalogFilters={category:string;query:string;maxPrice:number;size:string;color:string;available:boolean;sort:string;favorites?:string[]};
export function filterProducts(products:Product[],f:CatalogFilters){
 return products.filter(p=>{
  if(!p.published||f.favorites&&!f.favorites.includes(p.id))return false;
  if(f.category!=='Tout'&&(f.category==='Promotions'?!p.oldPrice:f.category==='Nouveautés'?p.badge!=='NOUVEAU':p.category!==f.category))return false;
  if(p.price>f.maxPrice||!p.name.toLocaleLowerCase('fr').includes(f.query.trim().toLocaleLowerCase('fr')))return false;
  const variants=p.variants||p.sizes.flatMap(size=>p.colors.map(color=>({size,color,stock:p.stock})));
  return variants.some(v=>(!f.size||v.size===f.size)&&(!f.color||v.color===f.color)&&(!f.available||v.stock>0));
 }).sort((a,b)=>f.sort==='asc'?a.price-b.price:f.sort==='desc'?b.price-a.price:f.sort==='name'?a.name.localeCompare(b.name,'fr'):0);
}

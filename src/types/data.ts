export type Product = {
  objectID: string;
  productName: string;
  productUrl: string;
  price: string;
  stock: string;
  imageUrl: string;
  category: string;
  source:
    | "robu"
    | "robokits"
    | "zbotic"
    | "sunrom"
    | "robocraze"
    | "makerbazar"
    | "quartz"
    | "evelta"
    | "estore";
  sourceImage: string;
};

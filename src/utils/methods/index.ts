// async function deleteQuartzProducts() {
//     try {
//       console.log("Deleting all products with source 'quartz'...");

//       // Use the `deleteBy` method to delete products where source is "quartz"
//       await index.deleteBy({
//         filters: 'source:"quartz"',
//       });

//       console.log("All products with source 'quartz' have been deleted.");
//     } catch (error) {
//       console.error("Error deleting products with source 'quartz':", error);
//     }
//   }
//   deleteQuartzProducts();

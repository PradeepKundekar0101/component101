import axios from "axios";

export async function fetchHTMLUsingAxios(url: string, useAxios = false) {
  try {
    if (useAxios) {
      const { data } = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          Connection: "keep-alive",
        },
      });
      return data;
    } else {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return await response.text();
    }
  } catch (error: any) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

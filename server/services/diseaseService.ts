import axios from "axios";

const DISEASE_API_URL =
  "https://8beihzhrx1.execute-api.ap-south-1.amazonaws.com/images";

export interface DiseaseRequest {
  images: string[];
  crop: string;
  location: string;
  language: string;
}

export async function detectDisease(data: DiseaseRequest): Promise<any> {
  const response = await axios.post(DISEASE_API_URL, data, {
    headers: { "Content-Type": "application/json" },
    timeout: 60000,
  });
  return response.data;
}

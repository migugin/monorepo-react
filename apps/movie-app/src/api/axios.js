import axios from "axios";

const instance = axios.create({
  baseURL: "https://api.themoviedb.org/3",
  params: {
    api_key: "c329d6530191faa779e777e07dd6b0f4",
    language: "ko-KR",
  },
});

export default instance;
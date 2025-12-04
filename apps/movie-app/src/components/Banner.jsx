import axios from "@/api/axios";
import requests from "@/api/request";
import { useEffect, useState } from "react";
import "@/style/components/Banner.scss";

function Banner() {
  const [movie, setMovie] = useState();

  useEffect(() => {
    async function fetchData() {
      const request = await axios.get(requests.fetchNowPlaying);

      const movieId = request.data.results[Math.floor(Math.random() * request.data.results.length)].id;

      const { data: movieDetail } = await axios.get(`/movie/${movieId}`, {
        params: { append_to_response: "videos" },
      });

      setMovie(movieDetail);
    }

    fetchData();
  }, []);

  const truncate = (str, n = 100) => {
    return str?.length > n ? str.substr(0, n - 1) + "..." : str;
  };

  return (
    <header
      className="banner"
      style={{
        ...(movie?.backdrop_path && {
          backgroundImage: `url("https://image.tmdb.org/t/p/original/${movie.backdrop_path}")`,
        }),
        backgroundPosition: "top center",
        backgroundSize: "cover",
      }}
    >
      <div className="banner__contents">
        <h1 className="banner__title">{movie?.title || movie?.name || movie?.original_name}</h1>
        <div className="banner__buttons">
          <button className="banner__button play">Play</button>
          <button className="banner__button info">More Information</button>
        </div>

        <h1 className="banner__description">{truncate(movie?.overview)}</h1>
      </div>
      <div className="banner__fadeBottom"></div>
    </header>
  );
}

export default Banner;

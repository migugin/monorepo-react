import axios from "@/api/axios";
import { useEffect, useState } from "react";
import "@/style/components/Row.scss";
import MovieModal from "./movieModal/MovieModal";

function Row({ title, id, fetchUrl, isLargeRow }) {
  const [movies, setMovies] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [movieSelected, setMovieSelected] = useState({});

  useEffect(() => {
    async function fetchMovieData() {
      const request = await axios.get(fetchUrl);

      setMovies(request.data.results);
    }

    fetchMovieData();
  }, [fetchUrl]);

  const handleClick = (movie) => {
    setMovieSelected(movie);
    setModalOpen(true);
  };

  return (
    <section className="row">
      <h2 className="row__title">{title}</h2>
      <div className="slider">
        <div
          className="slider__arrow-left"
          role="button"
          onClick={() => {
            document.getElementById(id).scrollLeft -= window.innerWidth - 80;
          }}
        >
          <span className="arrow">{"<"}</span>
        </div>

        <div className="row__posters" id={id}>
          {movies.map((movie) => (
            <img
              key={movie.id}
              src={`https://image.tmdb.org/t/p/original/${isLargeRow ? movie.poster_path : movie.backdrop_path}`}
              alt={movie.name}
              className={`row__poster ${isLargeRow && "row__poster-large"}`}
              onClick={() => handleClick(movie)}
            />
          ))}
        </div>

        <div
          className="slider__arrow-right"
          role="button"
          onClick={() => {
            document.getElementById(id).scrollLeft += window.innerWidth - 80;
          }}
        >
          <span className="arrow">{">"}</span>
        </div>
      </div>

      {modalOpen && <MovieModal {...movieSelected} setModalOpen={setModalOpen} />}
    </section>
  );
}

export default Row;

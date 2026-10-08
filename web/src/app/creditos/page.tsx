export const metadata = { title: "Créditos" };

const DATASET_URL = "https://www.kaggle.com/datasets/ledecanteur/fragrantica-perfumes";
const LICENSE_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/";

export default function CreditsPage() {
  return (
    <main id="contenido" className="catalog ficha">
      <header className="catalog-header">
        <p className="eyebrow">Créditos</p>
        <h1>Datos y licencias</h1>
        <p className="lead">Scentia es un proyecto personal de aprendizaje, sin fines de lucro.</p>
      </header>

      <section className="ficha-section" aria-labelledby="cr-datos">
        <h2 id="cr-datos">De dónde salen los datos</h2>
        <p>
          Los acordes con su intensidad, las notas con su peso, las estaciones, la duración y la estela, y los votos de la comunidad
          provienen del dataset{" "}
          <a href={DATASET_URL} rel="noopener noreferrer">
            “Fragrantica Perfumes: Ratings, Notes, Votes &amp; More”
          </a>{" "}
          publicado en Kaggle por <strong>ledecanteur</strong>, bajo la licencia{" "}
          <a href={LICENSE_URL} rel="noopener noreferrer">
            Creative Commons Atribución-NoComercial-CompartirIgual 4.0 (CC BY-NC-SA 4.0)
          </a>
          . Esos datos fueron recopilados de la comunidad de Fragrantica. Scentia no está afiliada a Fragrantica ni a ninguna marca.
        </p>
        <p>Parte del catálogo inicial proviene de un dataset anterior de Kaggle, también derivado de Fragrantica.</p>
      </section>

      <section className="ficha-section" aria-labelledby="cr-cambios">
        <h2 id="cr-cambios">Qué cambiamos</h2>
        <ul className="credits-list">
          <li>Traducimos los nombres de los acordes al español y mantuvimos las notas en inglés.</li>
          <li>Normalizamos nombres y marcas, y descartamos perfumes con muy pocos votos.</li>
          <li>Derivamos las estaciones y el momento del día a partir de los votos de la comunidad.</li>
          <li>Las portadas de los perfumes se generan automáticamente a partir de su acorde dominante: no son fotografías.</li>
        </ul>
      </section>

      <section className="ficha-section" aria-labelledby="cr-uso">
        <h2 id="cr-uso">Uso de los datos</h2>
        <p>
          Respetando la licencia, los datos se usan solo con fines no comerciales y con atribución. Lo que derivemos de ellos se comparte
          bajo los mismos términos (CC BY-NC-SA 4.0). Los nombres y marcas de los perfumes pertenecen a sus respectivos dueños.
        </p>
      </section>
    </main>
  );
}

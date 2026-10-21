export const metadata = { title: "Créditos" };

// Correo para pedir el retiro de una imagen: viene de la configuración (no hay uno por defecto) y se ignora si no parece un correo.
const CONTACT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "") ? process.env.NEXT_PUBLIC_CONTACT_EMAIL : null;

const DATASET_URL = "https://www.kaggle.com/datasets/ledecanteur/fragrantica-perfumes";
const LICENSE_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/";

export default function CreditsPage() {
  return (
    <main id="contenido" className="catalog ficha">
      <header className="catalog-header">
        <h1>Datos y licencias</h1>
        <p className="lead">Scentia es una guía de perfumes sin fines de lucro.</p>
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
          <li>Cuando un perfume no tiene foto, o la foto no carga, mostramos una portada generada a partir de su acorde dominante.</li>
        </ul>
      </section>

      <section className="ficha-section" aria-labelledby="cr-imagenes">
        <h2 id="cr-imagenes">Imágenes de los perfumes</h2>
        <p>
          Las fotos de los frascos se muestran <strong>enlazadas desde su origen</strong> (Fragrantica): Scentia no las descarga ni las
          aloja. Pertenecen a sus titulares —las marcas, los fotógrafos y la fuente—, y cada ficha indica de dónde viene la imagen.
          Si una foto no carga o se retira, se muestra una portada generada.
        </p>
        <p>
          Privacidad: para mostrar una foto, tu navegador la pide directamente al servidor de origen (<code>fimgs.net</code>), que puede
          registrar tu dirección IP. No les enviamos la página desde la que venís.
        </p>
        {CONTACT_EMAIL && (
          <p>
            Si sos titular de los derechos y querés que retiremos una imagen, escribinos a{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> y la ocultamos.
          </p>
        )}
      </section>

      <section className="ficha-section" aria-labelledby="cr-clima">
        <h2 id="cr-clima">Datos del clima</h2>
        <p>
          La página “¿Qué me pongo hoy?” consulta el clima y busca ciudades en{" "}
          <a href="https://open-meteo.com/" rel="noopener noreferrer">
            Open-Meteo.com
          </a>
          , bajo la licencia{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer">
            Creative Commons Atribución 4.0 (CC BY 4.0)
          </a>
          . Les enviamos una ubicación aproximada, redondeada a unos 10 km; no la guardamos.
        </p>
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

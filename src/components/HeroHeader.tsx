export function HeroHeader() {
  return (
    <header className="hero">
      <span className="hero-badge">年度品牌喜报</span>
      <h1 className="hero-title-art">
        <span className="sr-only">家财险到万家</span>
        <picture aria-hidden="true">
          <source srcSet="/brand/hero-title-gold.webp" type="image/webp" />
          <img
            className="hero-title-image"
            src="/brand/hero-title-gold.png"
            alt=""
            width="1898"
            height="414"
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </h1>
      <p>上传头像，选择模板，本地生成高清 PNG</p>
    </header>
  );
}

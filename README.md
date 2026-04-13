![](https://raw.githubusercontent.com/antares-sql/antares/master/docs/gh-logo.png)

# Antares SQL — Gen 2

![GitHub license](https://img.shields.io/github/license/TW199501/Antares2)

**English** | [繁體中文](./README.zh-TW.md)

> **Fork of** [**antares-sql/antares**](https://github.com/antares-sql/antares) by [Fabio Di Stasio](https://github.com/Fabio286), used and extended under the [MIT License](./LICENSE).  
> We built on top of the original work — full credit to the upstream project and all its contributors.

## What's new in Gen 2

| Area | Change |
| --- | --- |
| **Runtime** | Migrated from Electron to **Tauri v2** — lighter binary, better OS integration |
| **SQL Server** | Full support: SSL, read-only mode, single-connection mode, connection pool stability |
| **Stability** | Fixed connection race condition on database switch; sidecar auto-reconnect on restart |
| **Auto-update** | Replaced electron-updater with `tauri-plugin-updater` |

🔗 [Latest release](https://github.com/TW199501/Antares2/releases/latest) · [Original project](https://github.com/antares-sql/antares)

---

Antares is a cross-platform SQL client built with [Tauri v2](https://tauri.app/) and [Vue.js](https://github.com/vuejs/vue), aiming to be a forever-free, open-source tool for developers.  
This fork continues in the same spirit — open source, MIT licensed, community friendly.

🗳️ Polls:

*   [**Which is the main OS you use Antares on?**](https://github.com/antares-sql/antares/discussions/379)
*   [**Which database do you use the most?**](https://github.com/antares-sql/antares/discussions/594)

## Current key features

*   Multiple database connections at same time.
*   Database management (add/edit/delete).
*   Full tables management, including indexes and foreign keys.
*   Views, triggers, stored routines, functions and schedulers management (add/edit/delete).
*   A modern and friendly tab system; keep open every kind of tab you need in your workspace.
*   Fake table data filler to generate tons of data for test purpose.
*   Query suggestions and auto complete.
*   Query history: search through the last 1000 queries.
*   Save queries, notes or todo.
*   SSH tunnel support.
*   Manual commit mode.
*   Import and export database dumps.
*   Customizable keyboard shortcuts.
*   Dark and light theme.
*   Editor themes.

## Philosophy

Why are we developing an SQL client when there are a lot of them on the market?  
The main goal is to develop a **forever 100% free (without paid premium feature)**, full featured, as possible community driven, cross platform and open source alternative, empowered by JavaScript ecosystem.  
A modern application created with minimalism and simplicity in mind, with features in the right places, not hundreds of tiny buttons, nested tabs or submenues; productivity comes first.

## Installation

Based on your operating system you can have one or more distribution formats to choose based on your preferences.  
Since Antares SQL is a free software we don't have a budget to spend on annual licenses or certificates. This can result that on some platforms you might need to put in some additional work to install this app.

### Linux

On Linux you can simply download and run the `.AppImage` distribution, install from FlatHub, Snap Store, AUR or from our [PPA repository](https://github.com/antares-sql/antares-ppa).

### Windows

On Windows you can choose between downloading the app from Microsoft Store or downloading the `.exe` from our [website](https://antares-sql.app/downloads) or [this github repo](https://github.com/antares-sql/antares/releases/latest). Distributions that are not from Microsoft Store are not signed with a certificate, so to install you need to click on "More info" and then "Run anyway" on SmartScreen prompt.

### MacOS

On macOS you can run `.dmg` distribution following [this guide](https://support.apple.com/guide/mac-help/mh40616/mac) to install apps from unknown developers.

## Download

[![Download on Flathub](https://dl.flathub.org/assets/badges/flathub-badge-en.svg)](https://flathub.org/apps/it.fabiodistasio.AntaresSQL) [![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/antares) [![Get it from AUR](https://raw.githubusercontent.com/antares-sql/antares/master/docs/aur-badge.svg)](https://aur.archlinux.org/packages/antares-sql-bin) [![](https://developer.microsoft.com/store/badges/images/English_get-it-from-MS.png)](https://www.microsoft.com/p/antares-sql-client/9nhtb9sq51r1?cid=storebadge&ocid=badge&rtc=1&activetab=pivot:overviewtab)  
🚀 [**Other Downloads**](https://github.com/antares-sql/antares/releases/latest)

## Currently supported

### Databases

*   MySQL/MariaDB
*   PostgreSQL
*   SQLite
*   Firebird SQL
*   DuckDB
*   SQL Server
*   More...

### Operating Systems

#### • x64

*   Windows
*   Linux
*   MacOS

#### • ARM

*   Windows
*   Linux
*   MacOS

## How to contribute

*   🌍 [Translate Antares](https://github.com/antares-sql/antares/wiki/Translate-Antares)
*   📖 [Contributors Guide](https://github.com/antares-sql/antares/wiki/Contributors-Guide)
*   🚧 [Project Board](https://github.com/orgs/antares-sql/projects/3/views/2)

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<table><tbody><tr><td><a href="https://fabiodistasio.it/"><img src="https://avatars.githubusercontent.com/u/31471771?v=4?s=100" alt="Fabio Di Stasio"></a><br><a href="https://fabiodistasio.it/"><strong><sub>Fabio Di Stasio</sub></strong></a><br><a href="https://github.com/antares-sql/antares/commits?author=Fabio286">💻</a> <a href="#translation-Fabio286">🌍</a> <a href="https://github.com/antares-sql/antares/commits?author=Fabio286">📖</a></td><td><a href="https://www.linkedin.com/in/giulioganci/"><img src="https://avatars.githubusercontent.com/u/4192159?v=4?s=100" alt="Giulio Ganci"></a><br><a href="https://www.linkedin.com/in/giulioganci/"><strong><sub>Giulio Ganci</sub></strong></a><br><a href="https://github.com/antares-sql/antares/commits?author=toriphes">💻</a></td><td><a href="https://christianratz.de/"><img src="https://avatars.githubusercontent.com/u/2630316?v=4?s=100" alt="Christian Ratz"></a><br><a href="https://christianratz.de/"><strong><sub>Christian Ratz</sub></strong></a><br><a href="https://github.com/antares-sql/antares/commits?author=digitalgopnik">💻</a> <a href="#translation-digitalgopnik">🌍</a></td><td><a href="https://reverb6821.github.io/"><img src="https://avatars.githubusercontent.com/u/55198803?v=4?s=100" alt="Giuseppe Gigliotti"></a><br><a href="https://reverb6821.github.io/"><strong><sub>Giuseppe Gigliotti</sub></strong></a><br><a href="#translation-reverb6821">🌍</a></td><td><a href="https://github.com/Mohd-PH"><img src="https://avatars.githubusercontent.com/u/9362157?v=4?s=100" alt="Mohd-PH"></a><br><a href="https://github.com/Mohd-PH"><strong><sub>Mohd-PH</sub></strong></a><br><a href="#translation-Mohd-PH">🌍</a></td><td><a href="https://github.com/hongkfui"><img src="https://avatars.githubusercontent.com/u/37477191?v=4?s=100" alt="hongkfui"></a><br><a href="https://github.com/hongkfui"><strong><sub>hongkfui</sub></strong></a><br><a href="#translation-hongkfui">🌍</a></td><td><a href="https://github.com/MrAnyx"><img src="https://avatars.githubusercontent.com/u/44176707?v=4?s=100" alt="Robin"></a><br><a href="https://github.com/MrAnyx"><strong><sub>Robin</sub></strong></a><br><a href="#translation-MrAnyx">🌍</a></td></tr><tr><td><a href="https://github.com/daeleduardo"><img src="https://avatars.githubusercontent.com/u/8599078?v=4?s=100" alt="Daniel Eduardo"></a><br><a href="https://github.com/daeleduardo"><strong><sub>Daniel Eduardo</sub></strong></a><br><a href="#translation-daeleduardo">🌍</a></td><td><a href="https://ngoquocdat.com/"><img src="https://avatars.githubusercontent.com/u/56961917?v=4?s=100" alt="Ngô Quốc Đạt"></a><br><a href="https://ngoquocdat.com/"><strong><sub>Ngô Quốc Đạt</sub></strong></a><br><a href="#translation-datlechin">🌍</a></td><td><a href="https://github.com/IsamuSugi"><img src="https://avatars.githubusercontent.com/u/7746658?v=4?s=100" alt="Isamu Sugiura"></a><br><a href="https://github.com/IsamuSugi"><strong><sub>Isamu Sugiura</sub></strong></a><br><a href="#translation-IsamuSugi">🌍</a></td><td><a href="http://rsacchetto.nexxontech.it/"><img src="https://avatars.githubusercontent.com/u/18429412?v=4?s=100" alt="Riccardo Sacchetto"></a><br><a href="http://rsacchetto.nexxontech.it/"><strong><sub>Riccardo Sacchetto</sub></strong></a><br><a href="#platform-Occhioverde">📦</a></td><td><a href="https://kilianstallinger.com"><img src="https://avatars.githubusercontent.com/u/5290318?v=4?s=100" alt="Kilian Stallinger"></a><br><a href="https://kilianstallinger.com"><strong><sub>Kilian Stallinger</sub></strong></a><br><a href="https://github.com/antares-sql/antares/commits?author=kilianstallz">💻</a></td><td><a href="https://github.com/wenj91"><img src="https://avatars.githubusercontent.com/u/12549338?v=4?s=100" alt="文杰"></a><br><a href="https://github.com/wenj91"><strong><sub>文杰</sub></strong></a><br><a href="https://github.com/antares-sql/antares/commits?author=wenj91">💻</a></td><td><a href="https://github.com/goYou"><img src="https://avatars.githubusercontent.com/u/62732795?v=4?s=100" alt="goYou"></a><br><a href="https://github.com/goYou"><strong><sub>goYou</sub></strong></a><br><a href="#translation-goYou">🌍</a></td></tr><tr><td><a href="https://github.com/raliqala"><img src="https://avatars.githubusercontent.com/u/30502407?v=4?s=100" alt="Topollo"></a><br><a href="https://github.com/raliqala"><strong><sub>Topollo</sub></strong></a><br><a href="https://github.com/antares-sql/antares/commits?author=raliqala">💻</a></td><td><a href="https://github.com/SmileYzn"><img src="https://avatars.githubusercontent.com/u/5851851?v=4?s=100" alt="Cleverson"></a><br><a href="https://github.com/SmileYzn"><strong><sub>Cleverson</sub></strong></a><br><a href="#translation-SmileYzn">🌍</a></td><td><a href="https://github.com/fredatgithub"><img src="https://avatars.githubusercontent.com/u/6720055?v=4?s=100" alt="fred"></a><br><a href="https://github.com/fredatgithub"><strong><sub>fred</sub></strong></a><br><a href="#translation-fredatgithub">🌍</a></td><td><a href="https://github.com/xak666"><img src="https://avatars.githubusercontent.com/u/38811437?v=4?s=100" alt="xaka_xak"></a><br><a href="https://github.com/xak666"><strong><sub>xaka_xak</sub></strong></a><br><a href="#translation-xak666">🌍</a></td><td><a href="https://codepen.io/theo-billardey"><img src="https://avatars.githubusercontent.com/u/48206778?v=4?s=100" alt="Théo Billardey"></a><br><a href="https://codepen.io/theo-billardey"><strong><sub>Théo Billardey</sub></strong></a><br><a href="#translation-brdtheo">🌍</a></td><td><a href="http://yaskur.net"><img src="https://avatars.githubusercontent.com/u/9539970?v=4?s=100" alt="Muhammad Dyas Yaskur"></a><br><a href="http://yaskur.net"><strong><sub>Muhammad Dyas Yaskur</sub></strong></a><br><a href="#translation-dyaskur">🌍</a> <a href="https://github.com/antares-sql/antares/commits?author=dyaskur">💻</a></td><td><a href="https://github.com/jimcat8"><img src="https://avatars.githubusercontent.com/u/86754294?v=4?s=100" alt="tianci li"></a><br><a href="https://github.com/jimcat8"><strong><sub>tianci li</sub></strong></a><br><a href="#translation-jimcat8">🌍</a></td></tr><tr><td><a href="https://github.com/555cider"><img src="https://avatars.githubusercontent.com/u/73565447?v=4?s=100" alt="555cider"></a><br><a href="https://github.com/555cider"><strong><sub>555cider</sub></strong></a><br><a href="#translation-555cider">🌍</a></td><td><a href="https://github.com/m1khal3v"><img src="https://avatars.githubusercontent.com/u/41085561?v=4?s=100" alt="Anton Mikhalev"></a><br><a href="https://github.com/m1khal3v"><strong><sub>Anton Mikhalev</sub></strong></a><br><a href="#translation-m1khal3v">🌍</a></td><td><a href="https://64k.nl/"><img src="https://avatars.githubusercontent.com/u/3864423?v=4?s=100" alt="René"></a><br><a href="https://64k.nl/"><strong><sub>René</sub></strong></a><br><a href="https://github.com/antares-sql/antares/commits?author=64knl">💻</a> <a href="#translation-64knl">🌍</a></td><td><a href="https://github.com/zxp19821005"><img src="https://avatars.githubusercontent.com/u/4915850?v=4?s=100" alt="Woodenman"></a><br><a href="https://github.com/zxp19821005"><strong><sub>Woodenman</sub></strong></a><br><a href="#platform-zxp19821005">📦</a></td><td><a href="https://github.com/markusand"><img src="https://avatars.githubusercontent.com/u/12972543?v=4?s=100" alt="Marc Vilella"></a><br><a href="https://github.com/markusand"><strong><sub>Marc Vilella</sub></strong></a><br><a href="#translation-markusand">🌍</a></td><td><a href="https://github.com/Lawondyss"><img src="https://avatars.githubusercontent.com/u/272130?v=4?s=100" alt="Ladislav Vondráček"></a><br><a href="https://github.com/Lawondyss"><strong><sub>Ladislav Vondráček</sub></strong></a><br><a href="#translation-Lawondyss">🌍</a></td><td><a href="https://github.com/zvlad"><img src="https://avatars.githubusercontent.com/u/9055134?v=4?s=100" alt="Vladyslav"></a><br><a href="https://github.com/zvlad"><strong><sub>Vladyslav</sub></strong></a><br><a href="#translation-zvlad">🌍</a></td></tr><tr><td><a href="https://github.com/bagusindrayana"><img src="https://avatars.githubusercontent.com/u/36830534?v=4?s=100" alt="Bagus Indrayana"></a><br><a href="https://github.com/bagusindrayana"><strong><sub>Bagus Indrayana</sub></strong></a><br><a href="https://github.com/antares-sql/antares/commits?author=bagusindrayana">💻</a></td><td><a href="https://github.com/penguinlab"><img src="https://avatars.githubusercontent.com/u/10959317?v=4?s=100" alt="Naoki Ishikawa"></a><br><a href="https://github.com/penguinlab"><strong><sub>Naoki Ishikawa</sub></strong></a><br><a href="#translation-penguinlab">🌍</a></td><td><a href="https://fazevedo.dev"><img src="https://avatars.githubusercontent.com/u/1640325?v=4?s=100" alt="Filipe Azevedo"></a><br><a href="https://fazevedo.dev"><strong><sub>Filipe Azevedo</sub></strong></a><br><a href="https://github.com/antares-sql/antares/commits?author=mangas">💻</a></td><td><a href="https://github.com/zwei-c"><img src="https://avatars.githubusercontent.com/u/55912811?v=4?s=100" alt="CHANG, CHIH WEI"></a><br><a href="https://github.com/zwei-c"><strong><sub>CHANG, CHIH WEI</sub></strong></a><br><a href="#translation-zwei-c">🌍</a></td><td><a href="https://github.com/mirrorb"><img src="https://avatars.githubusercontent.com/u/34116207?v=4?s=100" alt="GaoChun"></a><br><a href="https://github.com/mirrorb"><strong><sub>GaoChun</sub></strong></a><br><a href="https://github.com/antares-sql/antares/commits?author=mirrorb">💻</a></td><td><a href="https://github.com/LeviEyal"><img src="https://avatars.githubusercontent.com/u/48846533?v=4?s=100" alt="Eyal Levi"></a><br><a href="https://github.com/LeviEyal"><strong><sub>Eyal Levi</sub></strong></a><br><a href="#translation-LeviEyal">🌍</a></td><td><a href="http://telegram.dog/SawGoD"><img src="https://avatars.githubusercontent.com/u/67802757?v=4?s=100" alt="Nikita Karelikov"></a><br><a href="http://telegram.dog/SawGoD"><strong><sub>Nikita Karelikov</sub></strong></a><br><a href="#translation-SawGoD">🌍</a></td></tr><tr><td><a href="https://github.com/carvalhods"><img src="https://avatars.githubusercontent.com/u/6569255?v=4?s=100" alt="David Carvalho"></a><br><a href="https://github.com/carvalhods"><strong><sub>David Carvalho</sub></strong></a><br><a href="#platform-carvalhods">📦</a></td><td><a href="https://github.com/r4f4dev"><img src="https://avatars.githubusercontent.com/u/65920592?v=4?s=100" alt="r4f4dev"></a><br><a href="https://github.com/r4f4dev"><strong><sub>r4f4dev</sub></strong></a><br><a href="#translation-r4f4dev">🌍</a></td><td><a href="https://github.com/salvymc"><img src="https://avatars.githubusercontent.com/u/10051897?v=4?s=100" alt="Salvatore Forino"></a><br><a href="https://github.com/salvymc"><strong><sub>Salvatore Forino</sub></strong></a><br><a href="https://github.com/antares-sql/antares/commits?author=salvymc">💻</a></td><td><a href="https://gadev.com.es/"><img src="https://avatars.githubusercontent.com/u/16820141?v=4?s=100" alt="José González"></a><br><a href="https://gadev.com.es/"><strong><sub>José González</sub></strong></a><br><a href="#translation-JoseGonzalez84">🌍</a></td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table>

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
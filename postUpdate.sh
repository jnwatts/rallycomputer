rm -Rf public

mkdir public
mkdir public/js
mkdir public/css
mkdir public/fonts

cp -a bower_components/bootstrap/dist/* public/

cp -a bower_components/dexie/dist/* public/js/

cp -a bower_components/jquery/dist/* public/js/

cp -a bower_components/normalize-css/normalize.css public/css/

cp -a bower_components/jquery.floatThead/dist/* public/js/

cp -a bower_components/jQuery-contextMenu/dist/* public/js/

ln -snf ../index.html public/index.html

ln -snf ../../rally.js public/js/
ln -snf ../../rally_ui.js public/js/
ln -snf ../../rally.css public/css/

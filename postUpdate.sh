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

cp -a bower_components/moment/min/*min* public/js/

ln -snf ../index.html public/index.html

ln -snf ../../rally.js public/js/
ln -snf ../../rally_ui.js public/js/
ln -snf ../../rally.css public/css/

cd public
CACHE='rally.mf'
echo "CACHE MANIFEST" >> $CACHE
echo "" >> $CACHE
echo "CACHE:" >> $CACHE
find . -not \( -type d -o -name ${CACHE} \) >> $CACHE
echo >> $CACHE
echo "NETWORK:" >> $CACHE
echo "*" >> $CACHE
sed -i'' -e '#^\.$#d' $CACHE
sed -i'' -e 's#^\./##' $CACHE

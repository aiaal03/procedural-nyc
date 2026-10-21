#!/bin/zsh
# The New York tour: renders the Midtown shots (crashed runs are taken up again) and cuts them together, day to night: tools/capture/tour.sh <workDir> <out.mp4>
set -e
W=$1 OUT=$2 HERE=${0:A:h}
mkdir -p $W
# (node and ffmpeg from the PATH; FFMPEG to name another ffmpeg)
FF=${FFMPEG:-ffmpeg}
render() { # shots file, dir, frames expected
  for i in 1 2 3 4 5; do
    [ -d $2 ] && [ $(ls $2 | wc -l) -ge $3 ] && return
    node $HERE/film.mjs $1 $2 1920x1080 30 > $2.log 2>&1 || true
  done
}
render $HERE/shots-tour-midtown.mjs $W/mid 945
# each shot is 135 frames: cut them into clips and lay them in order
clip() { $FF -loglevel error -y -framerate 30 -start_number $(( $3 * 135 )) -i $W/$1/f_%05d.png -frames:v 135 -c:v libx264 -crf 14 -pix_fmt yuv420p $W/c_$2.mp4; }
rm -f $W/c_*.mp4
for k in 0 1 2 3 4 5 6; do clip mid 0$k $k; done
ls $W/c_*.mp4 | sed "s|^|file '|; s|$|'|" > $W/list.txt
$FF -loglevel error -y -f concat -safe 0 -i $W/list.txt -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart $OUT
echo done $OUT

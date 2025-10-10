#!/usr/bin/env python3
"""
Export a Spotify playlist to CSV using the Spotify Web API.

Requirements:
  - Python 3.8+
  - pip install requests spotipy

You need a Spotify App with Client ID and Client Secret.
Create one at https://developer.spotify.com/dashboard
Set redirect URI to http://localhost:8888/callback

Usage:
  python export_spotify_playlist.py --playlist https://open.spotify.com/playlist/4Awm3VdOmrXrc1yI680zOP -o my_playlist.csv
  # or set env vars:
  SPOTIFY_CLIENT_ID="..." SPOTIFY_CLIENT_SECRET="..." SPOTIFY_REDIRECT_URI="http://localhost:8888/callback" python export_spotify_playlist.py --playlist 4Awm3VdOmrXrc1yI680zOP

The script accepts a full playlist URL, a spotify:playlist:... URI, or a bare playlist ID.
"""

import argparse
import csv
import os
import re
import sys
from typing import List, Dict, Any

import spotipy
import spotipy.util
from spotipy.oauth2 import SpotifyClientCredentials
from dotenv import load_dotenv

load_dotenv()


API_BASE = "https://api.spotify.com/v1"


def extract_playlist_id(s: str) -> str:
    # Accept URL, URI, or raw ID
    m = re.search(r"playlist/([A-Za-z0-9]+)", s)
    if m:
        return m.group(1)
    m = re.search(r"spotify:playlist:([A-Za-z0-9]+)", s)
    if m:
        return m.group(1)
    # Assume it's already an ID
    return s.strip()


def mmss(ms: int) -> str:
    total_seconds = ms // 1000
    m, s = divmod(total_seconds, 60)
    return f"{m}:{s:02d}"


def fetch_tracks(sp: spotipy.Spotify, playlist_id: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    results = sp.playlist_tracks(playlist_id)
    while results:
        batch = results['items']
        items.extend(batch)
        results = sp.next(results)
    return items


def to_rows(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for item in items:
        added_at = item.get("added_at", "")
        track = item.get("track") or {}
        if not track:
            continue
        name = track.get("name", "")
        artists = ", ".join([a.get("name", "")
                            for a in track.get("artists", [])])
        album = track.get("album", {}).get("name", "")
        duration_ms = int(track.get("duration_ms") or 0)
        duration = mmss(duration_ms)
        url = (track.get("external_urls") or {}).get("spotify", "")
        uri = track.get("uri", "")
        rows.append({
            "title": name,
            "artists": artists,
            "album": album,
            "duration_ms": duration_ms,
            "duration_mm_ss": duration,
            "added_at": added_at,
            "spotify_url": url,
            "spotify_uri": uri,
        })
    return rows


def get_playlist_created_date(sp: spotipy.Spotify, playlist_id: str) -> str:
    items = fetch_tracks(sp, playlist_id)
    if not items:
        return "Unknown"
    added_ats = [item.get('added_at')
                 for item in items if item.get('added_at')]
    if not added_ats:
        return "Unknown"
    # Return the earliest added_at as approximation of creation date
    return min(added_ats)


def generate_landing_page(top_albums: List[Dict[str, Any]], created_date_playlists: List[Dict[str, Any]], all_playlists: List[Dict[str, Any]], output: str = "index.html"):
    html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Spotify Playlists</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        h1 { color: #1DB954; text-align: center; }
        .section { margin: 40px 0; }
        .section h2 { color: #1DB954; border-bottom: 2px solid #1DB954; padding-bottom: 10px; }
        .playlist-list { list-style: none; padding: 0; }
        .playlist-list li { background-color: white; margin: 10px 0; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .playlist-list a { text-decoration: none; color: #333; display: block; }
        .playlist-list a:hover { color: #1DB954; }
        .playlist-name { font-size: 18px; font-weight: bold; }
        .playlist-details { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <h1>My Spotify Playlists</h1>
    <div class="section">
        <h2>Top 10 Albums</h2>
        <ul class="playlist-list">
"""
    for playlist in top_albums:
        name = playlist.get('name', '')
        pid = playlist.get('id', '')
        total_tracks = playlist.get('tracks', {}).get('total', 0)
        html += f"""            <li>
                <a href="{pid}.html">
                    <div class="playlist-name">{name}</div>
                    <div class="playlist-details">{total_tracks} tracks</div>
                </a>
            </li>
"""
    html += """        </ul>
    </div>
    <div class="section">
        <h2>Created Date</h2>
        <ul class="playlist-list">
"""
    for playlist in created_date_playlists:
        name = playlist.get('name', '')
        pid = playlist.get('id', '')
        total_tracks = playlist.get('tracks', {}).get('total', 0)
        created_date = playlist.get('created_date', 'Unknown')
        if created_date != 'Unknown':
            # Format date
            created_date = created_date[:10]  # YYYY-MM-DD
        html += f"""            <li>
                <a href="{pid}.html">
                    <div class="playlist-name">{name}</div>
                    <div class="playlist-details">{total_tracks} tracks - Created: {created_date}</div>
                </a>
            </li>
"""
    html += """        </ul>
    </div>
    <div class="section">
        <h2>All Playlists</h2>
        <ul class="playlist-list">
"""
    for playlist in sorted(all_playlists, key=lambda x: x.get('name', '').lower()):
        name = playlist.get('name', '')
        pid = playlist.get('id', '')
        total_tracks = playlist.get('tracks', {}).get('total', 0)
        html += f"""            <li>
                <a href="{pid}.html">
                    <div class="playlist-name">{name}</div>
                    <div class="playlist-details">{total_tracks} tracks</div>
                </a>
            </li>
"""
    html += """        </ul>
    </div>
</body>
</html>"""
    with open(output, "w", encoding="utf-8") as f:
        f.write(html)


def generate_html(playlist_name: str, fieldnames: List[str], rows: List[Dict[str, Any]], output: str):
    # Generate text file with numbered list
    txt_output = output.replace('.html', '.txt')
    with open(txt_output, 'w', encoding='utf-8') as f:
        f.write(f"{playlist_name}\n\n")
        for i, row in enumerate(rows, 1):
            title = row.get('title', '')
            artists = row.get('artists', '')
            f.write(f"{i}. {title} - {artists}\n")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{playlist_name} - Spotify Playlist</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }}
        h1 {{ color: #1DB954; text-align: center; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background-color: #1DB954; color: white; cursor: pointer; }}
        th:hover {{ background-color: #1aa34a; }}
        tr:nth-child(even) {{ background-color: #f9f9f9; }}
        tr:hover {{ background-color: #e9e9e9; }}
        .duration {{ text-align: right; }}
        .url {{ max-width: 200px; overflow: hidden; text-overflow: ellipsis; }}
        .download {{ text-align: center; margin: 20px; }}
        .download a {{ background-color: #1DB954; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }}
        .download a:hover {{ background-color: #1aa34a; }}
    </style>
</head>
<body>
    <h1>{playlist_name}</h1>
    <div class="download">
        <a href="{txt_output}" download>Download Numbered List</a>
    </div>
    <table id="playlist-table">
        <thead>
            <tr>
"""
    for field in fieldnames:
        if field == "duration_mm_ss":
            html += f"                <th class='duration'>{field.replace('_', ' ').title()}</th>\n"
        elif "url" in field:
            html += f"                <th class='url'>{field.replace('_', ' ').title()}</th>\n"
        else:
            html += f"                <th>{field.replace('_', ' ').title()}</th>\n"
    html += """            </tr>
        </thead>
        <tbody>
"""
    for row in rows:
        html += "            <tr>\n"
        for field in fieldnames:
            value = row.get(field, "")
            if field == "spotify_url":
                html += f"                <td class='url'><a href='{value}' target='_blank'>Open in Spotify</a></td>\n"
            elif field == "duration_mm_ss":
                html += f"                <td class='duration'>{value}</td>\n"
            else:
                html += f"                <td>{value}</td>\n"
        html += "            </tr>\n"
    html += """        </tbody>
    </table>
    <script>
        // Simple sort functionality
        document.querySelectorAll('th').forEach(header => {{
            header.addEventListener('click', () => {{
                const table = header.closest('table');
                const tbody = table.querySelector('tbody');
                const rows = Array.from(tbody.querySelectorAll('tr'));
                const index = Array.from(header.parentNode.children).indexOf(header);
                const isNumeric = header.classList.contains('duration') || header.textContent.includes('Ms');
                
                rows.sort((a, b) => {{
                    const aVal = a.children[index].textContent.trim();
                    const bVal = b.children[index].textContent.trim();
                    if (isNumeric) {{
                        return parseFloat(aVal.replace(':', '.')) - parseFloat(bVal.replace(':', '.'));
                    }}
                    return aVal.localeCompare(bVal);
                }});
                
                rows.forEach(row => tbody.appendChild(row));
            }});
        }});
    </script>
</body>
</html>"""
    with open(output, "w", encoding="utf-8") as f:
        f.write(html)


def main():
    parser = argparse.ArgumentParser(
        description="Export a Spotify playlist to CSV or list playlists")
    parser.add_argument("--playlist", "-p",
                        help="Playlist URL/URI/ID to export")
    parser.add_argument("-o", "--output", default=None,
                        help="Output CSV file (default: <playlist_id>.csv)")
    parser.add_argument("--create-playlist",
                        help="Create a new playlist with the given name")
    parser.add_argument("--description", default="",
                        help="Description for new playlist")
    parser.add_argument("--public", action="store_true",
                        help="Make new playlist public (default private)")
    parser.add_argument("--list", action="store_true",
                        help="List all user playlists instead of exporting")
    parser.add_argument("--landing-page", action="store_true",
                        help="Generate a landing page (index.html) with links to playlist pages")
    parser.add_argument("--include-audio-features", action="store_true",
                        help="Include audio features (danceability, energy, etc.) in export")
    parser.add_argument("--format", choices=["csv", "html"], default="csv",
                        help="Output format: csv or html (default: csv)")
    parser.add_argument(
        "--username", help="Spotify username (or set SPOTIFY_USERNAME env var)")
    parser.add_argument(
        "--client-id", help="Spotify Client ID (or set SPOTIFY_CLIENT_ID env var)")
    parser.add_argument(
        "--client-secret", help="Spotify Client Secret (or set SPOTIFY_CLIENT_SECRET env var)")
    parser.add_argument(
        "--redirect-uri", help="Spotify Redirect URI (or set SPOTIFY_REDIRECT_URI env var)")
    args = parser.parse_args()

    if not args.list and not args.playlist and not args.landing_page:
        parser.error("--playlist, --list, or --landing-page is required")

    client_id = args.client_id or os.getenv("SPOTIFY_CLIENT_ID")
    if not client_id:
        client_id = input("Enter Spotify Client ID: ").strip()
    client_secret = args.client_secret or os.getenv("SPOTIFY_CLIENT_SECRET")
    if not client_secret:
        client_secret = input("Enter Spotify Client Secret: ").strip()

    if args.create_playlist or args.list or args.landing_page:
        # User authentication required for private operations
        username = args.username or os.getenv("SPOTIFY_USERNAME")
        if not username:
            username = input("Enter your Spotify username: ").strip()
        redirect_uri = args.redirect_uri or os.getenv("SPOTIFY_REDIRECT_URI")
        if not redirect_uri:
            redirect_uri = input("Enter Spotify Redirect URI: ").strip()

        scope = "playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private"
        token = spotipy.util.prompt_for_user_token(
            username, scope, client_id, client_secret, redirect_uri)
        if not token:
            raise SystemExit(
                "Unable to get token. Check your credentials and try again.")
        sp = spotipy.Spotify(auth=token)
    else:
        # Client credentials for public read operations
        client_credentials_manager = SpotifyClientCredentials(
            client_id, client_secret)
        sp = spotipy.Spotify(
            client_credentials_manager=client_credentials_manager)

    if args.create_playlist:
        playlist = sp.user_playlist_create(
            username, args.create_playlist, public=args.public, description=args.description)
        print(f"Created playlist: {playlist['name']} (ID: {playlist['id']})")
        return

    if args.list:
        print("Your playlists:")
        playlists = sp.current_user_playlists()
        while playlists:
            for playlist in playlists['items']:
                print(
                    f"- {playlist['name']} ({playlist['id']}) - {playlist['tracks']['total']} tracks")
            playlists = sp.next(playlists)
        return

    if args.landing_page:
        playlists = []
        results = sp.current_user_playlists()
        while results:
            playlists.extend(results['items'])
            results = sp.next(results)
        # Add created_date to each playlist
        for p in playlists:
            p['created_date'] = get_playlist_created_date(sp, p['id'])
        # Top 10 albums (first 10 from API)
        top_albums = playlists[:10]
        # Created date sorted (earliest first)
        created_date_playlists = sorted(playlists, key=lambda x: x.get(
            'created_date') or '9999-99-99T99:99:99Z')[:10]
        # Generate HTML for all playlists
        for playlist in playlists:
            pid = playlist['id']
            output_html = f"{pid}.html"
            print(f"[+] Generating {output_html}")
            items = fetch_tracks(sp, pid)
            rows = to_rows(items)
            fieldnames = list(rows[0].keys()) if rows else ["title", "artists", "album",
                                                            "duration_ms", "duration_mm_ss", "added_at", "spotify_url", "spotify_uri"]
            generate_html(playlist['name'], fieldnames, rows, output_html)
        generate_landing_page(top_albums, created_date_playlists, playlists)
        print("[✓] Generated landing page index.html and all playlist pages")
        return

    playlist_id = extract_playlist_id(args.playlist)
    playlist_info = sp.playlist(playlist_id)
    playlist_name = playlist_info['name']

    if args.format == "html":
        output = args.output or f"{playlist_id}.html"
    else:
        output = args.output or f"{playlist_id}.csv"

    print(f"[+] Exporting playlist {playlist_id} -> {output}")
    items = fetch_tracks(sp, playlist_id)
    rows = to_rows(items)

    if args.include_audio_features:
        track_ids = [item['track']['id'] for item in items if item.get(
            'track') and item['track'].get('id')]
        if track_ids:
            features_list = sp.audio_features(track_ids)
            for row, features in zip(rows, features_list):
                if features:
                    row.update(features)

    fieldnames = list(rows[0].keys()) if rows else ["title", "artists", "album",
                                                    "duration_ms", "duration_mm_ss", "added_at", "spotify_url", "spotify_uri"]
    if args.format == "html":
        generate_html(playlist_name, fieldnames, rows, output)
    else:
        with open(output, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    print(f"[✓] Wrote {len(rows)} tracks to {output}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)

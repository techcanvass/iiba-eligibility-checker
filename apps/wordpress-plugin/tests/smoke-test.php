<?php
/**
 * Smoke test: loads the real plugin file with minimal WordPress stubs and verifies hooks,
 * shortcode output, escaping, settings sanitizing, and the metadata checks that
 * WordPress.org's Plugin Check blocks submissions on (version/text-domain mismatches).
 * Run: php apps/wordpress-plugin/tests/smoke-test.php
 */

define( 'ABSPATH', __DIR__ . '/' );
const SLUG = 'ba-certification-finder';
const PLUGIN_FILE = __DIR__ . '/../' . SLUG . '.php';
const README_FILE = __DIR__ . '/../readme.txt';

// ---------- Minimal WordPress stubs ----------
$GLOBALS['hooks']      = array();
$GLOBALS['shortcodes'] = array();
$GLOBALS['enqueued']   = array();
$GLOBALS['options']    = array();

function add_action( $h, $cb ) { $GLOBALS['hooks'][ $h ][] = $cb; }
function add_filter( $h, $cb ) { $GLOBALS['hooks'][ $h ][] = $cb; }
function add_shortcode( $tag, $cb ) { $GLOBALS['shortcodes'][ $tag ] = $cb; }
function get_option( $k, $d = false ) { return $GLOBALS['options'][ $k ] ?? $d; }
function wp_parse_args( $a, $d ) { return array_merge( $d, $a ); }
function shortcode_atts( $pairs, $atts ) {
	$atts = (array) $atts;
	$out  = array();
	foreach ( $pairs as $k => $v ) { $out[ $k ] = array_key_exists( $k, $atts ) ? $atts[ $k ] : $v; }
	return $out;
}
function wp_enqueue_script( $h ) { $GLOBALS['enqueued'][] = "js:$h"; }
function wp_enqueue_style( $h ) { $GLOBALS['enqueued'][] = "css:$h"; }
function esc_attr( $s ) { return htmlspecialchars( (string) $s, ENT_QUOTES, 'UTF-8' ); }
function esc_html( $s ) { return htmlspecialchars( (string) $s, ENT_QUOTES, 'UTF-8' ); }
function esc_html__( $s ) { return esc_html( $s ); }
function __( $s ) { return $s; }
function sanitize_text_field( $s ) { return trim( strip_tags( (string) $s ) ); }
function esc_url( $u ) {
	$u = trim( (string) $u );
	if ( '' === $u ) { return ''; }
	return preg_match( '#^https?://#i', $u ) ? esc_attr( $u ) : ''; // WP drops javascript: etc.
}
function esc_url_raw( $u ) { return html_entity_decode( esc_url( $u ) ); }
function plugin_basename( $f ) { return SLUG . '/' . basename( $f ); }

// ---------- Load plugin ----------
require PLUGIN_FILE;

$pass = 0;
$fail = 0;
function check( $name, $cond ) {
	global $pass, $fail;
	if ( $cond ) { $pass++; echo "  ✓ $name\n"; } else { $fail++; echo "  ✗ $name\n"; }
}

echo "BA Certification Finder — PHP smoke test\n";

// ---------- Hooks ----------
check( 'new shortcode registered', ( $GLOBALS['shortcodes']['ba_certification_finder'] ?? null ) === 'bacf_shortcode' );
check( 'legacy v1 shortcode still registered', ( $GLOBALS['shortcodes']['iiba_eligibility_checker'] ?? null ) === 'bacf_shortcode' );
check( 'assets hooked to wp_enqueue_scripts', in_array( 'bacf_register_assets', $GLOBALS['hooks']['wp_enqueue_scripts'] ?? array(), true ) );
check( 'settings page hooked to admin_menu', in_array( 'bacf_add_settings_page', $GLOBALS['hooks']['admin_menu'] ?? array(), true ) );

// ---------- Shortcode output ----------
$html = bacf_shortcode( array() );
check( 'default output has mount point', strpos( $html, 'class="bacf-root"' ) !== false );
check( 'default compact = 0', strpos( $html, 'data-compact="0"' ) !== false );
check( 'default hide_intro = 0', strpos( $html, 'data-hide-intro="0"' ) !== false );
check( 'only the script is enqueued (styles ship inside it)', $GLOBALS['enqueued'] === array( 'js:bacf-finder' ) );
check( 'no separate stylesheet registered', strpos( file_get_contents( PLUGIN_FILE ), 'wp_register_style' ) === false );

// ---------- Optimisation-plugin opt-outs ----------
$tag = bacf_script_tag( "<script src='https://x/ba-certification-finder.js?ver=1' id='bacf-finder-js'></script>\n", 'bacf-finder' );
check( 'script tag opts out of WP-Optimize delay', strpos( $tag, 'data-no-delay-js' ) !== false );
check( 'script tag opts out of LiteSpeed / WP Rocket / Cloudflare', strpos( $tag, 'data-no-optimize="1"' ) !== false && strpos( $tag, 'nowprocket' ) !== false && strpos( $tag, 'data-cfasync="false"' ) !== false );
check( 'attributes added only once', substr_count( bacf_script_tag( $tag, 'bacf-finder' ), 'data-no-delay-js' ) === 1 );
$other = "<script src='https://x/jquery.js' id='jquery-js'></script>";
check( 'other scripts untouched', bacf_script_tag( $other, 'jquery' ) === $other );
check( 'WP-Optimize exclusion added', in_array( '/wp-content/plugins/ba-certification-finder/', bacf_wpo_exclusions( array( '/a/' ) ), true ) );
check( 'WP-Optimize exclusion tolerates bad input', bacf_wpo_exclusions( null ) === array( '/wp-content/plugins/ba-certification-finder/' ) );

$html = bacf_shortcode( array( 'compact' => 'YES', 'hide_intro' => 'true' ), '', 'iiba_eligibility_checker' );
check( 'legacy tag: compact="YES" → 1', strpos( $html, 'data-compact="1"' ) !== false );
check( 'hide_intro="true" → 1', strpos( $html, 'data-hide-intro="1"' ) !== false );

$html = bacf_shortcode( array( 'rules_url' => 'javascript:alert(1)' ) );
check( 'javascript: rules_url dropped', strpos( $html, 'data-rules-url=""' ) !== false );

$html = bacf_shortcode( array( 'rules_url' => 'https://x.com/r.json?a=1&b="><script>alert(1)</script>' ) );
check( 'XSS in rules_url is neutralised', strpos( $html, '<script>' ) === false );

$html = bacf_shortcode( array( 'compact' => '"><script>alert(1)</script>' ) );
check( 'junk compact value → 0, not echoed', strpos( $html, 'data-compact="0"' ) !== false && strpos( $html, '<script>' ) === false );

$GLOBALS['options']['bacf_settings'] = array( 'rules_url' => 'https://example.com/r.json' );
$html = bacf_shortcode( array() );
check( 'saved rules URL used as default', strpos( $html, 'https://example.com/r.json' ) !== false );

$clean = bacf_sanitize_settings( array( 'rules_url' => ' https://ok.com/x.json ', 'utm' => 'old value' ) );
check( 'sanitize trims URL', 'https://ok.com/x.json' === $clean['rules_url'] );
check( 'sanitize drops unknown keys', array_keys( $clean ) === array( 'rules_url' ) );
check( 'sanitize handles non-array input', bacf_sanitize_settings( 'junk' ) === array( 'rules_url' => '' ) );

// ---------- Metadata (what Plugin Check blocks on) ----------
$php    = file_get_contents( PLUGIN_FILE );
$readme = file_get_contents( README_FILE );
preg_match( '/^\s*\*\s*Version:\s*(\S+)/m', $php, $hv );
preg_match( '/^\s*\*\s*Text Domain:\s*(\S+)/m', $php, $td );
preg_match( '/^Stable tag:\s*(\S+)/m', $readme, $st );
preg_match( '/^Tested up to:\s*(\S+)/m', $readme, $tu );
preg_match( '/^=== (.+) ===/m', $readme, $rn );
preg_match( '/^\s*\*\s*Plugin Name:\s*(.+)$/m', $php, $pn );

check( "header Version ({$hv[1]}) = readme Stable tag ({$st[1]}) = BACF_VERSION", $hv[1] === $st[1] && $st[1] === BACF_VERSION );
check( "Text Domain matches slug ({$td[1]})", $td[1] === SLUG );
preg_match_all( "/(?:__|_e|esc_html__|esc_html_e|esc_attr__|esc_attr_e)\(\s*'[^']*',\s*'([^']+)'\s*\)/", $php, $domains );
$bad = array_unique( array_diff( $domains[1], array( SLUG ) ) );
check( 'every translation call uses the slug as text domain (' . count( $domains[1] ) . ' calls)', count( $domains[1] ) > 5 && empty( $bad ) );
check( "readme name matches Plugin Name ({$rn[1]})", trim( $rn[1] ) === trim( $pn[1] ) );
check( "Tested up to is current major WordPress ({$tu[1]})", version_compare( $tu[1], '7.1', '>=' ) );
check( 'slug does not start with a trademark', stripos( SLUG, 'iiba' ) !== 0 && stripos( SLUG, 'pmi' ) !== 0 );
preg_match( '/^Tags:\s*(.+)$/m', $readme, $tags );
check( 'at most 5 readme tags', count( array_map( 'trim', explode( ',', $tags[1] ) ) ) <= 5 );
preg_match( '/^License:\s*(.+)$/m', $readme, $lic );
check( 'GPL-compatible licence', stripos( $lic[1], 'GPL' ) !== false );
$short = trim( explode( "\n\n", explode( "License URI:", $readme )[1] )[1] );
check( 'readme short description ≤ 150 chars (' . strlen( $short ) . ')', strlen( $short ) <= 150 );
preg_match( '/^\s*\*\s*Plugin URI:\s*(\S+)/m', $php, $pu );
preg_match( '/^\s*\*\s*Author URI:\s*(\S+)/m', $php, $au );
check( 'Plugin URI and Author URI are not the same (WordPress.org review rule)', empty( $pu ) || empty( $au ) || $pu[1] !== $au[1] );
check( 'direct-access guard in main file', strpos( $php, "if ( ! defined( 'ABSPATH' ) )" ) !== false );

echo "\n$pass passed, $fail failed\n";
exit( $fail > 0 ? 1 : 0 );

<?php
/**
 * Smoke test: loads the real plugin file with minimal WordPress stubs and
 * verifies hooks, shortcode output, escaping and settings sanitizing.
 * Run: php apps/wordpress-plugin/tests/smoke-test.php
 */

define( 'ABSPATH', __DIR__ . '/' );

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
function plugin_basename( $f ) { return 'iiba-eligibility-checker/' . basename( $f ); }

// ---------- Load plugin ----------
require __DIR__ . '/../iiba-eligibility-checker.php';

$pass = 0;
$fail = 0;
function check( $name, $cond ) {
	global $pass, $fail;
	if ( $cond ) { $pass++; echo "  ✓ $name\n"; } else { $fail++; echo "  ✗ $name\n"; }
}

echo "IIBA Eligibility Checker — PHP smoke test\n";

check( 'shortcode registered', isset( $GLOBALS['shortcodes']['iiba_eligibility_checker'] ) );
check( 'assets hooked to wp_enqueue_scripts', in_array( 'iiba_ec_register_assets', $GLOBALS['hooks']['wp_enqueue_scripts'] ?? array(), true ) );
check( 'settings page hooked to admin_menu', in_array( 'iiba_ec_add_settings_page', $GLOBALS['hooks']['admin_menu'] ?? array(), true ) );

$html = iiba_ec_shortcode( array() );
check( 'default output has mount point', strpos( $html, 'class="iiba-eligibility-root"' ) !== false );
check( 'default compact = 0', strpos( $html, 'data-compact="0"' ) !== false );
check( 'default hide_intro = 0', strpos( $html, 'data-hide-intro="0"' ) !== false );
check( 'no leftover UTM attribute', strpos( $html, 'data-utm' ) === false );
check( 'script + style enqueued only when used', $GLOBALS['enqueued'] === array( 'js:iiba-ec', 'css:iiba-ec' ) );

$html = iiba_ec_shortcode( array( 'compact' => 'YES', 'hide_intro' => 'true' ) );
check( 'compact="YES" → 1', strpos( $html, 'data-compact="1"' ) !== false );
check( 'hide_intro="true" → 1', strpos( $html, 'data-hide-intro="1"' ) !== false );

$html = iiba_ec_shortcode( array( 'rules_url' => 'javascript:alert(1)' ) );
check( 'javascript: rules_url dropped', strpos( $html, 'data-rules-url=""' ) !== false );

$html = iiba_ec_shortcode( array( 'rules_url' => 'https://x.com/r.json?a=1&b="><script>alert(1)</script>' ) );
check( 'XSS in rules_url is neutralised', strpos( $html, '<script>' ) === false );

$html = iiba_ec_shortcode( array( 'compact' => '"><script>alert(1)</script>' ) );
check( 'junk compact value → 0, not echoed', strpos( $html, 'data-compact="0"' ) !== false && strpos( $html, '<script>' ) === false );

$GLOBALS['options']['iiba_ec_settings'] = array( 'rules_url' => 'https://example.com/r.json' );
$html = iiba_ec_shortcode( array() );
check( 'saved rules URL used as default', strpos( $html, 'https://example.com/r.json' ) !== false );

$clean = iiba_ec_sanitize_settings( array( 'rules_url' => ' https://ok.com/x.json ', 'utm' => 'old value' ) );
check( 'sanitize trims URL', 'https://ok.com/x.json' === $clean['rules_url'] );
check( 'sanitize drops removed/unknown keys', array_keys( $clean ) === array( 'rules_url' ) );
check( 'sanitize handles non-array input', iiba_ec_sanitize_settings( 'junk' ) === array( 'rules_url' => '' ) );

echo "\n$pass passed, $fail failed\n";
exit( $fail > 0 ? 1 : 0 );

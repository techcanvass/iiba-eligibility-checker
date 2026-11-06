<?php
/**
 * Plugin Name:       BA Certification Finder
 * Description:       Guided finder that suggests ECBA, CCBA, CBAP, CBDA, AAC, CCA or PMI-PBA from a visitor's background and work. Shortcode: [ba_certification_finder].
 * Version:           2.0.1
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Techcanvass
 * Author URI:        https://www.techcanvass.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       ba-certification-finder
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'BACF_VERSION', '2.0.1' );
define( 'BACF_FILE', __FILE__ );
define( 'BACF_OPTION', 'bacf_settings' );

/**
 * Saved settings merged with defaults.
 *
 * @return array{rules_url:string}
 */
function bacf_get_settings() {
	$defaults = array(
		'rules_url' => '',
	);
	$saved    = get_option( BACF_OPTION, array() );
	return wp_parse_args( is_array( $saved ) ? $saved : array(), $defaults );
}

/**
 * Register (not enqueue) the script. It is enqueued only on pages that use the shortcode,
 * so the plugin adds nothing to page weight elsewhere. The styles are bundled inside the
 * script and injected when the finder is drawn (see source/apps/wordpress-plugin/src/wp-entry.tsx),
 * so "remove unused CSS" features in optimisation plugins can't strip them.
 */
function bacf_register_assets() {
	$dir = plugin_dir_path( BACF_FILE ) . 'assets/build/';
	$url = plugin_dir_url( BACF_FILE ) . 'assets/build/';

	// Cache-bust on rebuild using file modification time.
	$js_ver = file_exists( $dir . 'ba-certification-finder.js' ) ? (string) filemtime( $dir . 'ba-certification-finder.js' ) : BACF_VERSION;

	wp_register_script( 'bacf-finder', $url . 'ba-certification-finder.js', array(), $js_ver, true );
}
add_action( 'wp_enqueue_scripts', 'bacf_register_assets' );

/**
 * The finder is the page's main content, so it must run on load. Ask common optimisation
 * plugins not to delay or re-process this one script (the attributes are ignored elsewhere):
 * WP-Optimize (data-no-delay-js), LiteSpeed Cache (data-no-optimize), WP Rocket (nowprocket),
 * Cloudflare Rocket Loader (data-cfasync).
 *
 * @param string $tag    The <script> tag.
 * @param string $handle Script handle.
 * @return string
 */
function bacf_script_tag( $tag, $handle ) {
	if ( 'bacf-finder' !== $handle || false !== strpos( $tag, 'data-no-delay-js' ) ) {
		return $tag;
	}
	return str_replace( '<script ', '<script data-no-delay-js data-no-optimize="1" data-no-minify="1" nowprocket data-cfasync="false" ', $tag );
}
add_filter( 'script_loader_tag', 'bacf_script_tag', 10, 2 );

/**
 * Keep WP-Optimize's minify/merge away from the plugin's (already minified) files,
 * so the tag above keeps its attributes.
 *
 * @param string[] $exclusions Paths WP-Optimize skips.
 * @return string[]
 */
function bacf_wpo_exclusions( $exclusions ) {
	$exclusions   = is_array( $exclusions ) ? $exclusions : array();
	$exclusions[] = '/wp-content/plugins/ba-certification-finder/';
	return $exclusions;
}
add_filter( 'wp-optimize-minify-default-exclusions', 'bacf_wpo_exclusions' );

/**
 * [ba_certification_finder compact="no" hide_intro="no" rules_url=""]
 *
 * @param array|string $atts Shortcode attributes.
 * @param string       $content Unused.
 * @param string       $tag Shortcode tag used (supports the legacy tag too).
 * @return string
 */
function bacf_shortcode( $atts, $content = '', $tag = 'ba_certification_finder' ) {
	$settings = bacf_get_settings();

	$atts = shortcode_atts(
		array(
			'compact'    => 'no',
			'hide_intro' => 'no',
			'rules_url'  => $settings['rules_url'],
		),
		$atts,
		$tag
	);

	wp_enqueue_script( 'bacf-finder' );

	$is_yes = static function ( $value ) {
		return in_array( strtolower( (string) $value ), array( 'yes', '1', 'true' ), true );
	};

	return sprintf(
		'<div class="bacf-root" data-rules-url="%1$s" data-compact="%2$s" data-hide-intro="%3$s"><noscript>%4$s</noscript></div>',
		esc_url( $atts['rules_url'] ),
		$is_yes( $atts['compact'] ) ? '1' : '0',
		$is_yes( $atts['hide_intro'] ) ? '1' : '0',
		esc_html__( 'Please enable JavaScript to use the BA certification finder.', 'ba-certification-finder' )
	);
}
add_shortcode( 'ba_certification_finder', 'bacf_shortcode' );
// Legacy tag from v1, so pages built with the old shortcode keep working.
add_shortcode( 'iiba_eligibility_checker', 'bacf_shortcode' );

/* ---------------------------------------------------------------------------
 * Settings page: Settings → BA Certification Finder
 * ------------------------------------------------------------------------ */

function bacf_register_settings() {
	register_setting(
		'bacf',
		BACF_OPTION,
		array(
			'type'              => 'array',
			'sanitize_callback' => 'bacf_sanitize_settings',
			'default'           => array(),
		)
	);

	add_settings_section( 'bacf_main', '', '__return_false', 'bacf' );

	add_settings_field(
		'rules_url',
		__( 'Hosted rules URL', 'ba-certification-finder' ),
		'bacf_field_rules_url',
		'bacf',
		'bacf_main'
	);
}
add_action( 'admin_init', 'bacf_register_settings' );

/**
 * @param mixed $input Raw option value.
 * @return array{rules_url:string}
 */
function bacf_sanitize_settings( $input ) {
	$input = is_array( $input ) ? $input : array();
	return array(
		'rules_url' => isset( $input['rules_url'] ) ? esc_url_raw( trim( $input['rules_url'] ) ) : '',
	);
}

function bacf_field_rules_url() {
	$s = bacf_get_settings();
	printf(
		'<input type="url" class="regular-text" name="%1$s[rules_url]" value="%2$s" placeholder="https://example.com/iiba-rules.json" /><p class="description">%3$s</p>',
		esc_attr( BACF_OPTION ),
		esc_attr( $s['rules_url'] ),
		esc_html__( 'Optional. Leave blank to use the rules bundled with the plugin. Update the hosted file when a certification rule changes.', 'ba-certification-finder' )
	);
}

function bacf_add_settings_page() {
	add_options_page(
		__( 'BA Certification Finder', 'ba-certification-finder' ),
		__( 'BA Certification Finder', 'ba-certification-finder' ),
		'manage_options',
		'bacf',
		'bacf_render_settings_page'
	);
}
add_action( 'admin_menu', 'bacf_add_settings_page' );

function bacf_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'BA Certification Finder', 'ba-certification-finder' ); ?></h1>
		<p>
			<?php esc_html_e( 'Add the finder to any page or post with this shortcode:', 'ba-certification-finder' ); ?>
			<code>[ba_certification_finder]</code>
		</p>
		<form action="options.php" method="post">
			<?php
			settings_fields( 'bacf' );
			do_settings_sections( 'bacf' );
			submit_button();
			?>
		</form>
	</div>
	<?php
}

/**
 * "Settings" link on the Plugins screen.
 *
 * @param string[] $links Existing links.
 * @return string[]
 */
function bacf_action_links( $links ) {
	$links[] = '<a href="' . esc_url( admin_url( 'options-general.php?page=bacf' ) ) . '">' . esc_html__( 'Settings', 'ba-certification-finder' ) . '</a>';
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( BACF_FILE ), 'bacf_action_links' );

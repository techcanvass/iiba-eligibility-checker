<?php
/**
 * Plugin Name:       BA Certification Finder (IIBA Eligibility Checker)
 * Plugin URI:        https://www.techcanvass.com
 * Description:       Guided finder that suggests ECBA, CCBA, CBAP, CBDA, AAC, CCA or PMI-PBA from a visitor's background and work. Shortcode: [iiba_eligibility_checker].
 * Version:           2.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Techcanvass
 * Author URI:        https://www.techcanvass.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       iiba-eligibility-checker
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'IIBA_EC_VERSION', '2.0.0' );
define( 'IIBA_EC_FILE', __FILE__ );
define( 'IIBA_EC_OPTION', 'iiba_ec_settings' );

/**
 * Saved settings merged with defaults.
 *
 * @return array{rules_url:string}
 */
function iiba_ec_get_settings() {
	$defaults = array(
		'rules_url' => '',
	);
	$saved    = get_option( IIBA_EC_OPTION, array() );
	return wp_parse_args( is_array( $saved ) ? $saved : array(), $defaults );
}

/**
 * Register (not enqueue) assets. They are enqueued only on pages that use the shortcode,
 * so the plugin adds nothing to page weight elsewhere — good for PageSpeed.
 */
function iiba_ec_register_assets() {
	$dir = plugin_dir_path( IIBA_EC_FILE ) . 'assets/build/';
	$url = plugin_dir_url( IIBA_EC_FILE ) . 'assets/build/';

	// Cache-bust on rebuild using file modification time.
	$js_ver  = file_exists( $dir . 'iiba-eligibility-checker.js' ) ? (string) filemtime( $dir . 'iiba-eligibility-checker.js' ) : IIBA_EC_VERSION;
	$css_ver = file_exists( $dir . 'iiba-eligibility-checker.css' ) ? (string) filemtime( $dir . 'iiba-eligibility-checker.css' ) : IIBA_EC_VERSION;

	wp_register_script( 'iiba-ec', $url . 'iiba-eligibility-checker.js', array(), $js_ver, true );
	wp_register_style( 'iiba-ec', $url . 'iiba-eligibility-checker.css', array(), $css_ver );
}
add_action( 'wp_enqueue_scripts', 'iiba_ec_register_assets' );

/**
 * [iiba_eligibility_checker compact="no" hide_intro="no" rules_url=""]
 *
 * @param array|string $atts Shortcode attributes.
 * @return string
 */
function iiba_ec_shortcode( $atts ) {
	$settings = iiba_ec_get_settings();

	$atts = shortcode_atts(
		array(
			'compact'    => 'no',
			'hide_intro' => 'no',
			'rules_url'  => $settings['rules_url'],
		),
		$atts,
		'iiba_eligibility_checker'
	);

	wp_enqueue_script( 'iiba-ec' );
	wp_enqueue_style( 'iiba-ec' );

	$is_yes = static function ( $value ) {
		return in_array( strtolower( (string) $value ), array( 'yes', '1', 'true' ), true );
	};

	return sprintf(
		'<div class="iiba-eligibility-root" data-rules-url="%1$s" data-compact="%2$s" data-hide-intro="%3$s"><noscript>%4$s</noscript></div>',
		esc_url( $atts['rules_url'] ),
		$is_yes( $atts['compact'] ) ? '1' : '0',
		$is_yes( $atts['hide_intro'] ) ? '1' : '0',
		esc_html__( 'Please enable JavaScript to use the BA certification finder.', 'iiba-eligibility-checker' )
	);
}
add_shortcode( 'iiba_eligibility_checker', 'iiba_ec_shortcode' );

/* ---------------------------------------------------------------------------
 * Settings page: Settings → IIBA Eligibility
 * ------------------------------------------------------------------------ */

function iiba_ec_register_settings() {
	register_setting(
		'iiba_ec',
		IIBA_EC_OPTION,
		array(
			'type'              => 'array',
			'sanitize_callback' => 'iiba_ec_sanitize_settings',
			'default'           => array(),
		)
	);

	add_settings_section( 'iiba_ec_main', '', '__return_false', 'iiba-ec' );

	add_settings_field(
		'rules_url',
		__( 'Hosted rules URL', 'iiba-eligibility-checker' ),
		'iiba_ec_field_rules_url',
		'iiba-ec',
		'iiba_ec_main'
	);
}
add_action( 'admin_init', 'iiba_ec_register_settings' );

/**
 * @param mixed $input Raw option value.
 * @return array{rules_url:string}
 */
function iiba_ec_sanitize_settings( $input ) {
	$input = is_array( $input ) ? $input : array();
	return array(
		'rules_url' => isset( $input['rules_url'] ) ? esc_url_raw( trim( $input['rules_url'] ) ) : '',
	);
}

function iiba_ec_field_rules_url() {
	$s = iiba_ec_get_settings();
	printf(
		'<input type="url" class="regular-text" name="%1$s[rules_url]" value="%2$s" placeholder="https://example.com/iiba-rules.json" /><p class="description">%3$s</p>',
		esc_attr( IIBA_EC_OPTION ),
		esc_attr( $s['rules_url'] ),
		esc_html__( 'Optional. Leave blank to use the rules bundled with the plugin. Update the hosted file when IIBA changes a rule.', 'iiba-eligibility-checker' )
	);
}

function iiba_ec_add_settings_page() {
	add_options_page(
		__( 'IIBA Eligibility Checker', 'iiba-eligibility-checker' ),
		__( 'IIBA Eligibility', 'iiba-eligibility-checker' ),
		'manage_options',
		'iiba-ec',
		'iiba_ec_render_settings_page'
	);
}
add_action( 'admin_menu', 'iiba_ec_add_settings_page' );

function iiba_ec_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'IIBA Eligibility Checker', 'iiba-eligibility-checker' ); ?></h1>
		<p>
			<?php esc_html_e( 'Add the checker to any page or post with this shortcode:', 'iiba-eligibility-checker' ); ?>
			<code>[iiba_eligibility_checker]</code>
		</p>
		<form action="options.php" method="post">
			<?php
			settings_fields( 'iiba_ec' );
			do_settings_sections( 'iiba-ec' );
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
function iiba_ec_action_links( $links ) {
	$links[] = '<a href="' . esc_url( admin_url( 'options-general.php?page=iiba-ec' ) ) . '">' . esc_html__( 'Settings', 'iiba-eligibility-checker' ) . '</a>';
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( IIBA_EC_FILE ), 'iiba_ec_action_links' );
